package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/indusbase/indus-billing/internal/models"
)

type BillingRepository struct {
	db *sql.DB
}

func NewBillingRepository(db *sql.DB) *BillingRepository {
	return &BillingRepository{db: db}
}

func (r *BillingRepository) UpsertPlan(ctx context.Context, plan models.Plan) error {
	limitsJSON, _ := json.Marshal(plan.Limits)
	overageJSON, _ := json.Marshal(plan.OverageINR)
	_, err := r.db.ExecContext(ctx, `
INSERT INTO indusbase_billing.plans(key, name, monthly_inr, currency, limits, overage_inr, is_active)
VALUES ($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    monthly_inr = EXCLUDED.monthly_inr,
    currency = EXCLUDED.currency,
    limits = EXCLUDED.limits,
    overage_inr = EXCLUDED.overage_inr,
    is_active = EXCLUDED.is_active
`, plan.Key, plan.Name, plan.MonthlyINR, plan.Currency, limitsJSON, overageJSON, plan.IsActive)
	return err
}

func (r *BillingRepository) ListPlans(ctx context.Context) ([]models.Plan, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, key, name, monthly_inr, currency, limits, overage_inr, is_active
FROM indusbase_billing.plans
WHERE is_active = TRUE
ORDER BY monthly_inr ASC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Plan, 0)
	for rows.Next() {
		var plan models.Plan
		var limitsJSON []byte
		var overageJSON []byte
		if err := rows.Scan(&plan.ID, &plan.Key, &plan.Name, &plan.MonthlyINR, &plan.Currency, &limitsJSON, &overageJSON, &plan.IsActive); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(limitsJSON, &plan.Limits)
		_ = json.Unmarshal(overageJSON, &plan.OverageINR)
		out = append(out, plan)
	}
	return out, rows.Err()
}

func (r *BillingRepository) UpsertDailyUsageRollups(ctx context.Context, projectID string) error {
	query := `
INSERT INTO indusbase_billing.usage_rollups (project_id, metric, period, quantity, updated_at)
SELECT project_id::uuid, metric, period::date, SUM(quantity)::bigint, NOW()
FROM indusbase_platform.usage_events
WHERE ($1 = '' OR project_id::text = $1)
GROUP BY project_id, metric, period
ON CONFLICT (project_id, metric, period) DO UPDATE
SET quantity = EXCLUDED.quantity,
    updated_at = NOW()
`
	_, err := r.db.ExecContext(ctx, query, projectID)
	return err
}

func (r *BillingRepository) UsageSummary(ctx context.Context, projectID string, from, to string) (map[string]int64, error) {
	query := `
SELECT metric, COALESCE(SUM(quantity),0)::bigint AS total
FROM indusbase_billing.usage_rollups
WHERE project_id::text = $1
  AND ($2 = '' OR period >= $2::date)
  AND ($3 = '' OR period <= $3::date)
GROUP BY metric
`
	rows, err := r.db.QueryContext(ctx, query, projectID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int64{}
	for rows.Next() {
		var metric string
		var total int64
		if err := rows.Scan(&metric, &total); err != nil {
			return nil, err
		}
		out[metric] = total
	}
	return out, rows.Err()
}

func (r *BillingRepository) DailyUsage(ctx context.Context, projectID string, days int) ([]map[string]interface{}, error) {
	if days <= 0 {
		days = 30
	}
	rows, err := r.db.QueryContext(ctx, `
SELECT period, metric, quantity
FROM indusbase_billing.usage_rollups
WHERE project_id::text = $1
  AND period >= CURRENT_DATE - ($2::int)
ORDER BY period ASC
`, projectID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]map[string]interface{}, 0)
	for rows.Next() {
		var period time.Time
		var metric string
		var quantity int64
		if err := rows.Scan(&period, &metric, &quantity); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"period":   period.Format("2006-01-02"),
			"metric":   metric,
			"quantity": quantity,
		})
	}
	return out, rows.Err()
}

func (r *BillingRepository) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	q := `
INSERT INTO indusbase_billing.subscriptions
  (project_id, plan_key, status, start_at, end_at, business_name, gstin, billing_address, state_code, country_code)
VALUES
  ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9)
RETURNING id, start_at, created_at, updated_at
`
	return r.db.QueryRowContext(ctx, q, sub.ProjectID, sub.PlanKey, sub.Status, sub.EndAt, sub.BusinessName, sub.GSTIN, sub.BillingAddress, sub.StateCode, sub.CountryCode).
		Scan(&sub.ID, &sub.StartAt, &sub.CreatedAt, &sub.UpdatedAt)
}

func (r *BillingRepository) UpdateSubscription(ctx context.Context, id string, updates map[string]interface{}) error {
	set := ""
	args := []interface{}{}
	i := 1
	for key, value := range updates {
		if set != "" {
			set += ", "
		}
		set += fmt.Sprintf("%s = $%d", key, i)
		args = append(args, value)
		i++
	}
	if set == "" {
		return nil
	}
	args = append(args, id)
	_, err := r.db.ExecContext(ctx, fmt.Sprintf("UPDATE indusbase_billing.subscriptions SET %s, updated_at = NOW() WHERE id = $%d", set, i), args...)
	return err
}

func (r *BillingRepository) ActiveSubscriptionByProject(ctx context.Context, projectID string) (*models.Subscription, error) {
	q := `
SELECT id, project_id, plan_key, status, start_at, end_at, business_name, gstin, billing_address, state_code, country_code, created_at, updated_at
FROM indusbase_billing.subscriptions
WHERE project_id::text = $1 AND status = 'active'
ORDER BY created_at DESC
LIMIT 1
`
	var sub models.Subscription
	err := r.db.QueryRowContext(ctx, q, projectID).Scan(
		&sub.ID, &sub.ProjectID, &sub.PlanKey, &sub.Status, &sub.StartAt, &sub.EndAt,
		&sub.BusinessName, &sub.GSTIN, &sub.BillingAddress, &sub.StateCode, &sub.CountryCode,
		&sub.CreatedAt, &sub.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *BillingRepository) ListInvoices(ctx context.Context, projectID string) ([]models.Invoice, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, project_id, subscription_id, period_start, period_end, currency, subtotal, tax_amount, total_amount, status, due_at, paid_at, line_items, created_at
FROM indusbase_billing.invoices
WHERE ($1 = '' OR project_id::text = $1)
ORDER BY period_start DESC
LIMIT 100
`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Invoice, 0)
	for rows.Next() {
		var item models.Invoice
		if err := rows.Scan(
			&item.ID, &item.ProjectID, &item.SubscriptionID, &item.PeriodStart, &item.PeriodEnd, &item.Currency, &item.Subtotal, &item.TaxAmount, &item.TotalAmount, &item.Status, &item.DueAt, &item.PaidAt, &item.LineItems, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *BillingRepository) GetInvoice(ctx context.Context, id string) (*models.Invoice, error) {
	var item models.Invoice
	err := r.db.QueryRowContext(ctx, `
SELECT id, project_id, subscription_id, period_start, period_end, currency, subtotal, tax_amount, total_amount, status, due_at, paid_at, line_items, created_at
FROM indusbase_billing.invoices
WHERE id = $1
`, id).Scan(
		&item.ID, &item.ProjectID, &item.SubscriptionID, &item.PeriodStart, &item.PeriodEnd, &item.Currency, &item.Subtotal, &item.TaxAmount, &item.TotalAmount, &item.Status, &item.DueAt, &item.PaidAt, &item.LineItems, &item.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}
