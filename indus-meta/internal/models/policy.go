package models

// Policy represents a Row Level Security policy
type Policy struct {
	Schema      string `json:"schema" db:"schemaname"`
	Table       string `json:"table" db:"tablename"`
	Name        string `json:"name" db:"policyname"`
	Command     string `json:"command" db:"cmd"`
	Permissive  string `json:"permissive" db:"permissive"`
	Roles       string `json:"roles" db:"roles"`
	Using       string `json:"using,omitempty" db:"qual"`
	WithCheck   string `json:"with_check,omitempty" db:"with_check"`
	Description string `json:"description,omitempty"`
}

// CreatePolicyRequest represents a request to create a policy
type CreatePolicyRequest struct {
	Schema     string   `json:"schema" binding:"required"`
	Table      string   `json:"table" binding:"required"`
	Name       string   `json:"name" binding:"required"`
	Command    string   `json:"command" binding:"required"` // ALL, SELECT, INSERT, UPDATE, DELETE
	Roles      []string `json:"roles,omitempty"`            // empty means PUBLIC
	Using      string   `json:"using,omitempty"`            // for SELECT, UPDATE, DELETE
	WithCheck  string   `json:"with_check,omitempty"`       // for INSERT, UPDATE
	Permissive bool     `json:"permissive"`                 // true = PERMISSIVE, false = RESTRICTIVE
}

// AlterPolicyRequest represents a request to alter a policy
type AlterPolicyRequest struct {
	Roles     []string `json:"roles,omitempty"`
	Using     *string  `json:"using,omitempty"`
	WithCheck *string  `json:"with_check,omitempty"`
}
