#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
ORANGE='\033[0;33m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/.claude/review-prompt.md"
REVIEWS_DIR="$SCRIPT_DIR/.claude/reviews"
TIMESTAMP="$(date +%Y-%m-%d-%H%M%S)"
REVIEW_FILE="$REVIEWS_DIR/review-$TIMESTAMP.md"

# ─── Helpers ──────────────────────────────────────────────────────────────────
die() {
    echo -e "${RED}Error:${RESET} $1" >&2
    exit 2
}

info() {
    echo -e "${BOLD}$1${RESET}"
}

# ─── Preflight checks ────────────────────────────────────────────────────────
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    die "Not inside a git repository."
fi

if ! command -v claude &>/dev/null; then
    die "'claude' CLI is not installed or not in PATH."
fi

if [[ ! -f "$PROMPT_FILE" ]]; then
    die "Reviewer prompt not found at $PROMPT_FILE"
fi

mkdir -p "$REVIEWS_DIR"

# ─── Code file extensions ────────────────────────────────────────────────────
CODE_EXTENSIONS="ts tsx js jsx py c cpp h hpp java go rs rb php swift kt kts scala cs vue svelte lua sh bash zsh fish"

# ─── Parse arguments ─────────────────────────────────────────────────────────
MODE=""
ARGS=()
SEVERITY_FILTER=""
MAX_FILES=10
DIR_RECURSIVE=true

while [[ $# -gt 0 ]]; do
    case "$1" in
        --last-commit)
            MODE="last-commit"
            shift
            ;;
        --staged)
            MODE="staged"
            shift
            ;;
        --severity)
            if [[ -z "${2:-}" ]]; then
                die "--severity requires a comma-separated list (e.g., critical,high)"
            fi
            SEVERITY_FILTER="$2"
            shift 2
            ;;
        --max-files)
            if [[ -z "${2:-}" ]]; then
                die "--max-files requires a number"
            fi
            MAX_FILES="$2"
            shift 2
            ;;
        --dir-recursive)
            DIR_RECURSIVE=true
            shift
            ;;
        --no-dir-recursive)
            DIR_RECURSIVE=false
            shift
            ;;
        -*)
            die "Unknown flag: $1"
            ;;
        *)
            ARGS+=("$1")
            shift
            ;;
    esac
done

# ─── Resolve directories into file lists ─────────────────────────────────────
FILES=()

find_code_files() {
    local dir="$1"
    local find_args=()

    # Build -name conditions for all extensions
    local first=true
    for ext in $CODE_EXTENSIONS; do
        if $first; then
            find_args+=("(" "-name" "*.${ext}")
            first=false
        else
            find_args+=("-o" "-name" "*.${ext}")
        fi
    done
    find_args+=(")")

    if $DIR_RECURSIVE; then
        find "$dir" -type f "${find_args[@]}" | sort
    else
        find "$dir" -maxdepth 1 -type f "${find_args[@]}" | sort
    fi
}

for arg in "${ARGS[@]}"; do
    if [[ -d "$arg" ]]; then
        # It's a directory — resolve to code files
        mapfile -t dir_files < <(find_code_files "$arg")
        if [[ ${#dir_files[@]} -eq 0 ]]; then
            die "No code files found in directory: $arg"
        fi
        FILES+=("${dir_files[@]}")
    elif [[ -f "$arg" ]]; then
        FILES+=("$arg")
    else
        die "Not a file or directory: $arg"
    fi
done

# ─── Check file count limit ─────────────────────────────────────────────────
if [[ ${#FILES[@]} -gt $MAX_FILES ]]; then
    echo -e "${YELLOW}Found ${#FILES[@]} files (limit: $MAX_FILES):${RESET}"
    echo ""
    for f in "${FILES[@]}"; do
        echo "  $f"
    done
    echo ""
    echo -e "Use ${BOLD}--max-files ${#FILES[@]}${RESET} to review all, or pass specific files/dirs."
    read -rp "Continue with all ${#FILES[@]} files? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# ─── Gather code to review ───────────────────────────────────────────────────
CODE=""

if [[ ${#FILES[@]} -gt 0 ]]; then
    # Review specific files in full
    for f in "${FILES[@]}"; do
        CODE+="--- File: $f ---"$'\n'
        CODE+="$(cat "$f")"$'\n\n'
    done
    if [[ ${#FILES[@]} -le 10 ]]; then
        info "Reviewing ${#FILES[@]} file(s): ${FILES[*]}"
    else
        info "Reviewing ${#FILES[@]} file(s)"
    fi
elif [[ "$MODE" == "last-commit" ]]; then
    CODE="$(git diff HEAD~1 HEAD)"
    if [[ -z "$CODE" ]]; then
        die "Last commit has no diff."
    fi
    info "Reviewing last commit diff."
elif [[ "$MODE" == "staged" ]]; then
    CODE="$(git diff --cached)"
    if [[ -z "$CODE" ]]; then
        die "No staged changes to review."
    fi
    info "Reviewing staged changes."
else
    # Default: unstaged, then staged, then nothing
    CODE="$(git diff)"
    if [[ -n "$CODE" ]]; then
        info "Reviewing unstaged changes."
    else
        CODE="$(git diff --cached)"
        if [[ -n "$CODE" ]]; then
            info "Reviewing staged changes (no unstaged changes found)."
        else
            die "No unstaged or staged changes to review."
        fi
    fi
fi

# ─── Build severity instruction ──────────────────────────────────────────────
SEVERITY_INSTRUCTION=""
if [[ -n "$SEVERITY_FILTER" ]]; then
    SEVERITY_INSTRUCTION="IMPORTANT: Only report findings with severity: $SEVERITY_FILTER. Omit all other severity levels from the output."
fi

# ─── Build the full prompt ───────────────────────────────────────────────────
SYSTEM_PROMPT="$(cat "$PROMPT_FILE")"

FULL_PROMPT="$SYSTEM_PROMPT

$SEVERITY_INSTRUCTION

Review the following code/diff. Today's date is $(date +%Y-%m-%d).

\`\`\`
$CODE
\`\`\`"

# ─── Call Claude ──────────────────────────────────────────────────────────────
info "Running review..."
echo ""

RESULT="$(echo "$FULL_PROMPT" | claude -p 2>&1)" || {
    die "claude command failed. Output:\n$RESULT"
}

# ─── Save review ─────────────────────────────────────────────────────────────
echo "$RESULT" > "$REVIEW_FILE"

# ─── Colorize and print to stdout ────────────────────────────────────────────
colorize_output() {
    local line
    while IFS= read -r line; do
        if [[ "$line" =~ "CRITICAL" ]]; then
            echo -e "${RED}${line}${RESET}"
        elif [[ "$line" =~ "HIGH" ]]; then
            echo -e "${ORANGE}${line}${RESET}"
        elif [[ "$line" =~ "MEDIUM" ]]; then
            echo -e "${YELLOW}${line}${RESET}"
        elif [[ "$line" =~ "LOW" ]]; then
            echo -e "${BLUE}${line}${RESET}"
        elif [[ "$line" =~ ^"## " ]] || [[ "$line" =~ ^"### " ]]; then
            echo -e "${BOLD}${line}${RESET}"
        else
            echo "$line"
        fi
    done
}

echo "$RESULT" | colorize_output
echo ""
echo -e "${GREEN}Review saved to:${RESET} $REVIEW_FILE"

# ─── Exit code based on findings ─────────────────────────────────────────────
if echo "$RESULT" | grep -qiE '(####.*CRITICAL|####.*HIGH|\[CR-[0-9]+\].*critical|\[CR-[0-9]+\].*high)'; then
    # Check if there are actual findings under CRITICAL or HIGH (not just empty headers)
    HAS_CRITICAL_FINDINGS=false

    # Extract text between CRITICAL header and next header
    CRITICAL_SECTION="$(echo "$RESULT" | sed -n '/####.*CRITICAL/,/####/p' | tail -n +2 | head -n -1)"
    if echo "$CRITICAL_SECTION" | grep -q '\[CR-'; then
        HAS_CRITICAL_FINDINGS=true
    fi

    # Extract text between HIGH header and next header
    HIGH_SECTION="$(echo "$RESULT" | sed -n '/####.*HIGH/,/####/p' | tail -n +2 | head -n -1)"
    if echo "$HIGH_SECTION" | grep -q '\[CR-'; then
        HAS_CRITICAL_FINDINGS=true
    fi

    if $HAS_CRITICAL_FINDINGS; then
        echo -e "${RED}${BOLD}EXIT 1:${RESET}${RED} Critical or high severity findings detected.${RESET}"
        exit 1
    fi
fi

echo -e "${GREEN}No critical or high findings.${RESET}"
exit 0
