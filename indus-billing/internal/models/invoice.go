package models

import "time"

type Invoice struct {
	ID             string     `json:"id"`
	ProjectID      string     `json:"project_id"`
	SubscriptionID *string    `json:"subscription_id,omitempty"`
	PeriodStart    time.Time  `json:"period_start"`
	PeriodEnd      time.Time  `json:"period_end"`
	Currency       string     `json:"currency"`
	Subtotal       int64      `json:"subtotal"`
	TaxAmount      int64      `json:"tax_amount"`
	TotalAmount    int64      `json:"total_amount"`
	Status         string     `json:"status"`
	DueAt          *time.Time `json:"due_at,omitempty"`
	PaidAt         *time.Time `json:"paid_at,omitempty"`
	LineItems      []byte     `json:"line_items"`
	CreatedAt      time.Time  `json:"created_at"`
}
