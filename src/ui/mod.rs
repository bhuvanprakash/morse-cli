//! Beautiful terminal UI components for Morse CLI

use crate::errors::MorseError;
use anyhow::Result;
use console::{Style, Emoji};
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use std::fmt;
use std::time::Duration;

pub struct Theme {
    pub primary: Style,
    pub secondary: Style,
    pub success: Style,
    pub warning: Style,
    pub error: Style,
    pub muted: Style,
    pub heading: Style,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            primary: Style::new().cyan().bold(),
            secondary: Style::new().blue(),
            success: Style::new().green().bold(),
            warning: Style::new().yellow().bold(),
            error: Style::new().red().bold(),
            muted: Style::new().black().bright(),
            heading: Style::new().magenta().bold(),
        }
    }
}

impl Theme {
    pub fn dark() -> Self {
        Self {
            primary: Style::new().cyan().bold(),
            secondary: Style::new().blue(),
            success: Style::new().green().bold(),
            warning: Style::new().yellow().bold(),
            error: Style::new().red().bold(),
            muted: Style::new().black().bright(),
            heading: Style::new().magenta().bold(),
        }
    }
}

pub struct UI {
    theme: Theme,
    #[allow(dead_code)]
    color_enabled: bool,
    #[allow(dead_code)]
    multi_progress: MultiProgress,
}

impl UI {
    pub fn new(color_enabled: bool) -> Self {
        Self {
            theme: if color_enabled { Theme::dark() } else { Theme::default() },
            color_enabled,
            multi_progress: MultiProgress::new(),
        }
    }

    pub fn header(&self, title: &str) -> String {
        let line = "═".repeat(title.len() + 4);
        let line2 = line.clone();
        format!(
            "\n{}\n  {} {}\n{}\n",
            self.theme.heading.apply_to(line),
            self.theme.primary.apply_to("▌"),
            self.theme.heading.apply_to(title),
            self.theme.heading.apply_to(line2)
        )
    }

    pub fn morse_ascii_art(&self) -> String {
        let art = r"███╗   ███╗ ██████╗ ██████╗ ███████╗███████╗
████╗ ████║██╔═══██╗██╔══██╗██╔════╝██╔════╝
██╔████╔██║██║   ██║██║   ██║███████╗████╗ 
██║╚██╔╝██║██║   ██║██║   ██║╚════██║╚════██║
██║ ╚═╝ ██║╚██████╔╝╚██████╔╝███████║██████╔╝
╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝";
        let tag = self.theme.muted.apply_to("── Terminal-first AI Coding Assistant ──");
        format!("{}\n{}", self.theme.primary.apply_to(art), tag)
    }

    pub fn success(&self, message: &str) -> String {
        let check = Emoji("✅", "(+)");
        format!("{} {}", self.theme.success.apply_to(check), self.theme.secondary.apply_to(message))
    }

    pub fn warning(&self, message: &str) -> String {
        let warn = Emoji("⚠️", "(!)");
        format!("{} {}", self.theme.warning.apply_to(warn), self.theme.secondary.apply_to(message))
    }

    pub fn error(&self, message: &str) -> String {
        let cross = Emoji("❌", "(-)");
        format!("{} {}", self.theme.error.apply_to(cross), self.theme.secondary.apply_to(message))
    }

    pub fn info(&self, message: &str) -> String {
        let info = Emoji("ℹ️", "(i)");
        format!("{} {}", self.theme.primary.apply_to(info), self.theme.secondary.apply_to(message))
    }

    pub fn bullet(&self, text: &str, level: usize) -> String {
        let indent = "  ".repeat(level);
        let marker = if level == 0 { "•" } else { "–" };
        format!("{}{} {}", indent, self.theme.muted.apply_to(marker), text)
    }

    pub fn section(&self, title: &str) -> String {
        format!("\n{} {}", self.theme.heading.apply_to("▸"), self.theme.primary.apply_to(title))
    }

    pub fn section_owned(&self, title: String) -> String {
        format!("\n{} {}", self.theme.heading.apply_to("▸"), self.theme.primary.apply_to(&title))
    }

    pub fn kv_pair(&self, key: &str, value: &str) -> String {
        format!(
            "  {:>12} {}",
            self.theme.muted.apply_to(format!("{}:", key)),
            self.theme.secondary.apply_to(value)
        )
    }

    /// A thin horizontal divider spanning `width` columns.
    pub fn divider(&self, width: usize) -> String {
        self.theme.muted.apply_to("─".repeat(width)).to_string()
    }

    /// Keyboard-hint chip, e.g. keyhint("Ctrl+C", "quit").
    pub fn keyhint(&self, key: &str, label: &str) -> String {
        format!(
            "{} {}",
            self.theme.heading.apply_to(format!(" {} ", key)),
            self.theme.muted.apply_to(label)
        )
    }

    pub fn progress_bar(&self, len: u64) -> ProgressBar {
        let pb = ProgressBar::new(len);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} ({eta})")
                .unwrap()
                .progress_chars("█▉▊▋▌▍▎▏  "),
        );
        pb.enable_steady_tick(Duration::from_millis(100));
        pb
    }

    pub fn spinner(&self, message: &str) -> ProgressBar {
        let pb = ProgressBar::new_spinner();
        pb.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap()
                .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]),
        );
        pb.set_message(message.to_string());
        pb.enable_steady_tick(Duration::from_millis(80));
        pb
    }

    pub fn boxed(&self, title: &str, content: &str) -> String {
        let lines: Vec<&str> = content.lines().collect();
        let max_width = lines.iter().map(|l| l.len()).max().unwrap_or(0).max(title.len()) + 4;
        let top = format!("┌{}┐", "─".repeat(max_width));
        let bottom = format!("└{}┘", "─".repeat(max_width));
        let title_line = format!(
            "│ {:<width$} │",
            self.theme.primary.apply_to(title),
            width = max_width - 2
        );

        let mut result = Vec::new();
        result.push(self.theme.secondary.apply_to(&top).to_string());
        result.push(self.theme.secondary.apply_to(&title_line).to_string());
        result.push(self.theme.secondary.apply_to(&format!("├{}┤", "─".repeat(max_width))).to_string());

        for line in &lines {
            result.push(format!(
                "│ {:<width$} │",
                line,
                width = max_width - 2
            ));
        }

        result.push(self.theme.secondary.apply_to(&bottom).to_string());
        result.join("\n")
    }

    pub fn table(&self, headers: &[&str], rows: &[Vec<&str>]) -> String {
        let cols = headers.len();
        let mut widths: Vec<usize> = headers.iter().map(|h| console::measure_text_width(h)).collect();
        for row in rows {
            for (i, cell) in row.iter().enumerate() {
                if i < cols {
                    widths[i] = widths[i].max(console::measure_text_width(cell));
                }
            }
        }

        let rule = |l: &str, m: &str, r: &str| {
            let mid: Vec<String> = widths.iter().map(|w| "\u{2500}".repeat(w + 2)).collect();
            self.theme.muted.apply_to(format!("{}{}{}", l, mid.join(m), r)).to_string()
        };

        let mut out = String::new();
        out.push_str(&rule("\u{250c}", "\u{252c}", "\u{2510}"));
        out.push('\n');

        let cells: Vec<String> = headers
            .iter()
            .enumerate()
            .map(|(i, h)| {
                let pad = widths[i].saturating_sub(console::measure_text_width(h));
                format!(" {}{} ", h, " ".repeat(pad))
            })
            .collect();
        out.push_str(&self.theme.heading.apply_to(format!("\u{2502}{}\u{2502}", cells.join("\u{2502}"))).to_string());
        out.push('\n');
        out.push_str(&rule("\u{251c}", "\u{253c}", "\u{2524}"));
        out.push('\n');

        for row in rows {
            let mut cells: Vec<String> = Vec::with_capacity(cols);
            for (i, w) in widths.iter().enumerate() {
                let cell = row.get(i).copied().unwrap_or("");
                let pad = w.saturating_sub(console::measure_text_width(cell));
                cells.push(format!(" {}{} ", cell, " ".repeat(pad)));
            }
            out.push_str(&format!("\u{2502}{}\u{2502}\n", cells.join("\u{2502}")));
        }

        out.push_str(&rule("\u{2514}", "\u{2534}", "\u{2518}"));
        out
    }

    pub fn print(&self, text: &str) {
        println!("{}", text);
    }

    pub fn muted(&self, text: &str) -> String {
        self.theme.muted.apply_to(text).to_string()
    }

    pub fn print_error(&self, error: &MorseError) {
        eprintln!("{}", self.error(&error.display()));
    }

    pub fn confirm(&self, message: &str) -> Result<bool> {
        Ok(dialoguer::Confirm::new()
            .with_prompt(message)
            .default(false)
            .interact()?)
    }

    pub fn input(&self, prompt: &str) -> Result<String> {
        Ok(dialoguer::Input::new()
            .with_prompt(prompt)
            .interact_text()?)
    }

    pub fn select<T: fmt::Display + Clone>(&self, prompt: &str, items: &[T]) -> Result<T> {
        let selection = dialoguer::Select::new()
            .with_prompt(prompt)
            .items(items)
            .interact()?;
        Ok(items[selection].clone())
    }

    pub fn multi_select<T: fmt::Display + Clone>(&self, prompt: &str, items: &[T]) -> Result<Vec<T>> {
        let selections = dialoguer::MultiSelect::new()
            .with_prompt(prompt)
            .items(items)
            .interact()?;
        Ok(selections.into_iter().map(|i| items[i].clone()).collect())
    }

    pub fn password(&self, prompt: &str) -> Result<String> {
        Ok(dialoguer::Password::new()
            .with_prompt(prompt)
            .interact()?)
    }
}
