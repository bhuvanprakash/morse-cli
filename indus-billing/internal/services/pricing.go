package services

import "github.com/indusbase/indus-billing/internal/models"

func DefaultPlans() []models.Plan {
	return []models.Plan{
		{
			Key:        "free",
			Name:       "Free",
			MonthlyINR: 0,
			Currency:   "INR",
			Limits: map[string]int64{
				"api_requests":           500000,
				"db_rows":                1000000,
				"storage_bytes":          5 * 1024 * 1024 * 1024,
				"vector_search_requests": 10000,
				"emails_sent":            10000,
				"sms_sent":               500,
				"webhook_deliveries":     10000,
				"edge_invocations":       50000,
			},
			OverageINR: map[string]float64{
				"sms_sent": 0.25,
			},
			IsActive: true,
		},
		{
			Key:        "pro",
			Name:       "Pro",
			MonthlyINR: 3999,
			Currency:   "INR",
			Limits: map[string]int64{
				"api_requests":           5000000,
				"db_rows":                10000000,
				"storage_bytes":          100 * 1024 * 1024 * 1024,
				"vector_search_requests": 200000,
				"emails_sent":            100000,
				"sms_sent":               5000,
				"webhook_deliveries":     500000,
				"edge_invocations":       1000000,
			},
			OverageINR: map[string]float64{
				"api_requests": 0.0003,
				"emails_sent":  0.02,
				"sms_sent":     0.20,
			},
			IsActive: true,
		},
		{
			Key:        "growth",
			Name:       "Growth",
			MonthlyINR: 14999,
			Currency:   "INR",
			Limits: map[string]int64{
				"api_requests":           25000000,
				"db_rows":                50000000,
				"storage_bytes":          500 * 1024 * 1024 * 1024,
				"vector_search_requests": 1000000,
				"emails_sent":            500000,
				"sms_sent":               30000,
				"webhook_deliveries":     2500000,
				"edge_invocations":       5000000,
			},
			OverageINR: map[string]float64{
				"api_requests": 0.0002,
				"emails_sent":  0.015,
				"sms_sent":     0.17,
			},
			IsActive: true,
		},
		{
			Key:        "enterprise",
			Name:       "Enterprise",
			MonthlyINR: 0,
			Currency:   "INR",
			Limits: map[string]int64{
				"api_requests":           1000000000,
				"db_rows":                1000000000,
				"storage_bytes":          20 * 1024 * 1024 * 1024 * 1024,
				"vector_search_requests": 10000000,
				"emails_sent":            10000000,
				"sms_sent":               1000000,
				"webhook_deliveries":     10000000,
				"edge_invocations":       50000000,
			},
			OverageINR: map[string]float64{},
			IsActive:   true,
		},
	}
}
