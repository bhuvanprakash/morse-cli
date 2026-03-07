package models

import "time"

type Subscription struct {
	ID             string     `json:"id"`
	ProjectID      string     `json:"project_id"`
	PlanKey        string     `json:"plan_key"`
	Status         string     `json:"status"`
	StartAt        time.Time  `json:"start_at"`
	EndAt          *time.Time `json:"end_at,omitempty"`
	BusinessName   *string    `json:"business_name,omitempty"`
	GSTIN          *string    `json:"gstin,omitempty"`
	BillingAddress *string    `json:"billing_address,omitempty"`
	StateCode      *string    `json:"state_code,omitempty"`
	CountryCode    *string    `json:"country_code,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
