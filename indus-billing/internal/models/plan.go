package models

type Plan struct {
	ID         string             `json:"id"`
	Key        string             `json:"key"`
	Name       string             `json:"name"`
	MonthlyINR int64              `json:"monthly_inr"`
	Currency   string             `json:"currency"`
	Limits     map[string]int64   `json:"limits"`
	OverageINR map[string]float64 `json:"overage_inr"`
	IsActive   bool               `json:"is_active"`
}
