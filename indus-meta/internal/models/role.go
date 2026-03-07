package models

// Role represents a database role
type Role struct {
	Name       string   `json:"name" db:"rolname"`
	Superuser  bool     `json:"superuser" db:"rolsuper"`
	Inherit    bool     `json:"inherit" db:"rolinherit"`
	CreateRole bool     `json:"create_role" db:"rolcreaterole"`
	CreateDB   bool     `json:"create_db" db:"rolcreatedb"`
	Login      bool     `json:"login" db:"rolcanlogin"`
	Privileges []string `json:"privileges,omitempty"`
}

// CreateRoleRequest represents a request to create a role
type CreateRoleRequest struct {
	Name       string `json:"name" binding:"required"`
	Password   string `json:"password,omitempty"`
	Login      bool   `json:"login"`
	Superuser  bool   `json:"superuser"`
	CreateDB   bool   `json:"create_db"`
	CreateRole bool   `json:"create_role"`
	Inherit    bool   `json:"inherit"`
}

// AlterRoleRequest represents a request to alter a role
type AlterRoleRequest struct {
	Password   *string `json:"password,omitempty"`
	Login      *bool   `json:"login,omitempty"`
	Superuser  *bool   `json:"superuser,omitempty"`
	CreateDB   *bool   `json:"create_db,omitempty"`
	CreateRole *bool   `json:"create_role,omitempty"`
}

// GrantPrivilegeRequest represents a request to grant privileges
type GrantPrivilegeRequest struct {
	Privilege string `json:"privilege" binding:"required"` // SELECT, INSERT, UPDATE, DELETE, ALL
	Schema    string `json:"schema" binding:"required"`
	Object    string `json:"object" binding:"required"` // table name or ALL TABLES
}
