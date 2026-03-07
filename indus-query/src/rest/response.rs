use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub meta: PaginationMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationMeta {
    pub page: u32,
    pub limit: u32,
    pub total: u64,
    pub total_pages: u32,
    pub has_next: bool,
    pub has_prev: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SingleResponse<T> {
    pub data: T,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    pub code: Option<String>,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, page: u32, limit: u32, total: u64) -> Self {
        let total_pages = if total == 0 {
            1
        } else {
            ((total as f64) / (limit as f64)).ceil() as u32
        };
        let has_next = page < total_pages;
        let has_prev = page > 1;

        Self {
            data,
            meta: PaginationMeta {
                page,
                limit,
                total,
                total_pages,
                has_next,
                has_prev,
            },
        }
    }

    pub fn empty(page: u32, limit: u32) -> Self {
        Self::new(Vec::new(), page, limit, 0)
    }

    pub fn map<U, F>(self, f: F) -> PaginatedResponse<U>
    where
        F: FnMut(T) -> U,
    {
        PaginatedResponse {
            data: self.data.into_iter().map(f).collect(),
            meta: self.meta,
        }
    }
}

impl<T> SingleResponse<T> {
    pub fn new(data: T) -> Self {
        Self { data }
    }
}

impl ErrorResponse {
    pub fn new(error: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            message: message.into(),
            code: None,
        }
    }

    pub fn with_code(
        error: impl Into<String>,
        message: impl Into<String>,
        code: impl Into<String>,
    ) -> Self {
        Self {
            error: error.into(),
            message: message.into(),
            code: Some(code.into()),
        }
    }
}

/// Create a paginated JSON response
pub fn paginated_response(
    data: Vec<Value>,
    page: u32,
    limit: u32,
    total: u64,
) -> PaginatedResponse<Value> {
    PaginatedResponse::new(data, page, limit, total)
}

/// Create a single resource JSON response
pub fn single_response(data: Value) -> SingleResponse<Value> {
    SingleResponse::new(data)
}

/// Create an error response
pub fn error_response(error: impl Into<String>, message: impl Into<String>) -> ErrorResponse {
    ErrorResponse::new(error, message)
}

/// Convert rows from database to JSON values
pub fn rows_to_json(rows: Vec<serde_json::Value>) -> Vec<Value> {
    rows
}

/// Calculate offset from page and limit
pub fn calculate_offset(page: u32, limit: u32) -> u32 {
    (page.saturating_sub(1)) * limit
}

/// Calculate total pages
pub fn calculate_total_pages(total: u64, limit: u32) -> u32 {
    if total == 0 || limit == 0 {
        1
    } else {
        ((total as f64) / (limit as f64)).ceil() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paginated_response() {
        let data = vec![
            serde_json::json!({"id": 1}),
            serde_json::json!({"id": 2}),
        ];
        let response = PaginatedResponse::new(data, 1, 20, 100);

        assert_eq!(response.meta.page, 1);
        assert_eq!(response.meta.limit, 20);
        assert_eq!(response.meta.total, 100);
        assert_eq!(response.meta.total_pages, 5);
        assert!(response.meta.has_next);
        assert!(!response.meta.has_prev);
    }

    #[test]
    fn test_paginated_response_last_page() {
        let data = vec![serde_json::json!({"id": 5})];
        let response = PaginatedResponse::new(data, 5, 20, 100);

        assert_eq!(response.meta.page, 5);
        assert!(!response.meta.has_next);
        assert!(response.meta.has_prev);
    }

    #[test]
    fn test_paginated_response_empty() {
        let response: PaginatedResponse<Value> = PaginatedResponse::empty(1, 20);

        assert!(response.data.is_empty());
        assert_eq!(response.meta.total, 0);
        assert_eq!(response.meta.total_pages, 1);
        assert!(!response.meta.has_next);
        assert!(!response.meta.has_prev);
    }

    #[test]
    fn test_calculate_offset() {
        assert_eq!(calculate_offset(1, 20), 0);
        assert_eq!(calculate_offset(2, 20), 20);
        assert_eq!(calculate_offset(3, 25), 50);
    }

    #[test]
    fn test_calculate_total_pages() {
        assert_eq!(calculate_total_pages(100, 20), 5);
        assert_eq!(calculate_total_pages(101, 20), 6);
        assert_eq!(calculate_total_pages(0, 20), 1);
    }

    #[test]
    fn test_error_response() {
        let err = ErrorResponse::new("not_found", "Resource not found");
        assert_eq!(err.error, "not_found");
        assert_eq!(err.message, "Resource not found");
        assert_eq!(err.code, None);

        let err = ErrorResponse::with_code("not_found", "Resource not found", "404");
        assert_eq!(err.code, Some("404".to_string()));
    }
}
