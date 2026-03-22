#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL_DB_DIR="$HOME/.claude/memory"
GLOBAL_DB="$GLOBAL_DB_DIR/global.db"
PROJECT_DB_DIR="$SCRIPT_DIR/.claude/memory"
PROJECT_DB="$PROJECT_DB_DIR/project.db"
PROJECT_CLAUDE_MD="$SCRIPT_DIR/CLAUDE.md"
GLOBAL_CLAUDE_MD="$HOME/.claude/CLAUDE.md"
REVIEW_PROMPT="$SCRIPT_DIR/.claude/review-prompt.md"

VALID_PROJECT_CATEGORIES=("decision" "convention" "architecture" "dependency" "other")
VALID_GLOBAL_CATEGORIES=("convention" "preference" "pattern" "other")

DEFAULT_PROJECT_CATEGORY="decision"
DEFAULT_GLOBAL_CATEGORY="convention"

MARKER_START="<!-- MEMORY:START -->"
MARKER_END="<!-- MEMORY:END -->"

# ─── Helpers ──────────────────────────────────────────────────────────────────
die() {
    echo -e "${RED}Error:${RESET} $1" >&2
    exit 1
}

info() {
    echo -e "${BOLD}$1${RESET}"
}

success() {
    echo -e "${GREEN}$1${RESET}"
}

# ─── Preflight ────────────────────────────────────────────────────────────────
require_sqlite() {
    if ! command -v sqlite3 &>/dev/null; then
        die "sqlite3 is not installed. Install it with: ${BOLD}sudo apt install sqlite3${RESET}"
    fi
}

# ─── Init databases ──────────────────────────────────────────────────────────
DATABASES_INITIALIZED=false

init_db() {
    local db_path="$1"
    local db_dir
    db_dir="$(dirname "$db_path")"
    mkdir -p "$db_dir"
    sqlite3 "$db_path" <<'SQL'
CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'decision',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
SQL
}

ensure_databases() {
    if ! $DATABASES_INITIALIZED; then
        require_sqlite
        init_db "$GLOBAL_DB"
        init_db "$PROJECT_DB"
        DATABASES_INITIALIZED=true
    fi
}

# ─── Category color ──────────────────────────────────────────────────────────
category_color() {
    case "$1" in
        decision)      echo -e "${BLUE}$1${RESET}" ;;
        convention)    echo -e "${GREEN}$1${RESET}" ;;
        architecture)  echo -e "${MAGENTA}$1${RESET}" ;;
        dependency)    echo -e "${CYAN}$1${RESET}" ;;
        preference)    echo -e "${YELLOW}$1${RESET}" ;;
        pattern)       echo -e "${CYAN}$1${RESET}" ;;
        other)         echo -e "${DIM}$1${RESET}" ;;
        *)             echo "$1" ;;
    esac
}

# ─── Validate category ───────────────────────────────────────────────────────
validate_category() {
    local cat="$1"
    local scope="$2"
    local valid=()

    if [[ "$scope" == "global" ]]; then
        valid=("${VALID_GLOBAL_CATEGORIES[@]}")
    else
        valid=("${VALID_PROJECT_CATEGORIES[@]}")
    fi

    for v in "${valid[@]}"; do
        if [[ "$cat" == "$v" ]]; then
            return 0
        fi
    done

    die "Invalid category '$cat' for $scope. Valid: ${valid[*]}"
}

# ─── Format memory list ──────────────────────────────────────────────────────
print_memories() {
    local db="$1"
    local label="$2"
    local query="${3:-SELECT id, category, content, created_at FROM memories ORDER BY id}"

    local results
    results="$(sqlite3 -separator '|' "$db" "$query" 2>/dev/null)" || true

    if [[ -z "$results" ]]; then
        echo -e "  ${DIM}(no memories)${RESET}"
        return
    fi

    while IFS='|' read -r id cat content date; do
        local colored_cat
        colored_cat="$(category_color "$cat")"
        echo -e "  ${BOLD}#${id}${RESET}  [${colored_cat}]  ${content}  ${DIM}(${date})${RESET}"
    done <<< "$results"
}

# ─── SYNC ─────────────────────────────────────────────────────────────────────
sync_file() {
    local target_file="$1"
    local content="$2"

    local block
    block="$(printf '%s\n%s\n%s' "$MARKER_START" "$content" "$MARKER_END")"

    if [[ ! -f "$target_file" ]]; then
        echo "$block" > "$target_file"
        return
    fi

    if grep -qF "$MARKER_START" "$target_file"; then
        # Replace between markers
        local tmp
        tmp="$(mktemp)"
        local in_block=false
        while IFS= read -r line || [[ -n "$line" ]]; do
            if [[ "$line" == *"$MARKER_START"* ]]; then
                echo "$block" >> "$tmp"
                in_block=true
            elif [[ "$line" == *"$MARKER_END"* ]]; then
                in_block=false
            elif ! $in_block; then
                echo "$line" >> "$tmp"
            fi
        done < "$target_file"
        mv "$tmp" "$target_file"
    else
        # Append markers at end
        echo "" >> "$target_file"
        echo "$block" >> "$target_file"
    fi
}

do_sync() {
    ensure_databases
    local now
    now="$(date '+%Y-%m-%d %H:%M:%S')"

    # ── Build global memories text ────────────────────────────────────────
    local global_lines=""
    local global_data
    global_data="$(sqlite3 -separator '|' "$GLOBAL_DB" "SELECT category, content FROM memories ORDER BY category, id" 2>/dev/null)" || true

    if [[ -n "$global_data" ]]; then
        while IFS='|' read -r cat content; do
            global_lines+="- **[$cat]** $content"$'\n'
        done <<< "$global_data"
    fi

    # ── Build project memories text ───────────────────────────────────────
    local project_lines=""
    local project_data
    project_data="$(sqlite3 -separator '|' "$PROJECT_DB" "SELECT category, content FROM memories ORDER BY category, id" 2>/dev/null)" || true

    if [[ -n "$project_data" ]]; then
        while IFS='|' read -r cat content; do
            project_lines+="- **[$cat]** $content"$'\n'
        done <<< "$project_data"
    fi

    # ── Sync project CLAUDE.md ────────────────────────────────────────────
    local project_block="## Project Context (auto-generated by memory.sh — do not edit manually)"$'\n'
    project_block+=""$'\n'
    if [[ -n "$global_lines" ]]; then
        project_block+="### Global Conventions"$'\n'
        # For project CLAUDE.md, show global without category prefix
        local global_simple=""
        while IFS='|' read -r cat content; do
            global_simple+="- $content"$'\n'
        done <<< "$(sqlite3 -separator '|' "$GLOBAL_DB" "SELECT category, content FROM memories ORDER BY category, id" 2>/dev/null)"
        project_block+="$global_simple"
        project_block+=""$'\n'
    fi
    if [[ -n "$project_lines" ]]; then
        project_block+="### Project Decisions"$'\n'
        project_block+="$project_lines"
        project_block+=""$'\n'
    fi
    project_block+="*Last synced: $now*"

    sync_file "$PROJECT_CLAUDE_MD" "$project_block"
    success "Synced: $PROJECT_CLAUDE_MD"

    # ── Sync global CLAUDE.md ─────────────────────────────────────────────
    local global_block="## Global Conventions (auto-generated by memory.sh — do not edit manually)"$'\n'
    global_block+=""$'\n'
    if [[ -n "$global_lines" ]]; then
        # For global CLAUDE.md, show without category prefix
        local global_simple2=""
        while IFS='|' read -r cat content; do
            global_simple2+="- $content"$'\n'
        done <<< "$(sqlite3 -separator '|' "$GLOBAL_DB" "SELECT category, content FROM memories ORDER BY category, id" 2>/dev/null)"
        global_block+="$global_simple2"
    else
        global_block+="(no global conventions yet)"$'\n'
    fi
    global_block+=""$'\n'
    global_block+="*Last synced: $now*"

    sync_file "$GLOBAL_CLAUDE_MD" "$global_block"
    success "Synced: $GLOBAL_CLAUDE_MD"

    # ── Sync review-prompt.md (if exists) ─────────────────────────────────
    if [[ -f "$REVIEW_PROMPT" ]]; then
        local review_block="## Project-Specific Rules (auto-generated)"$'\n'
        if [[ -n "$project_data" ]]; then
            while IFS='|' read -r cat content; do
                review_block+="- $content"$'\n'
            done <<< "$project_data"
        else
            review_block+="(no project memories yet)"$'\n'
        fi

        sync_file "$REVIEW_PROMPT" "$review_block"
        success "Synced: $REVIEW_PROMPT"
    fi
}

# ─── ADD ──────────────────────────────────────────────────────────────────────
cmd_add() {
    ensure_databases
    local scope="project"
    local category=""
    local content=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --global)  scope="global"; shift ;;
            --category)
                if [[ -z "${2:-}" ]]; then die "--category requires a value"; fi
                category="$2"; shift 2 ;;
            *)  content="$1"; shift ;;
        esac
    done

    if [[ -z "$content" ]]; then
        die "Usage: memory.sh add [--global] [--category CAT] \"memory text\""
    fi

    if [[ -z "$category" ]]; then
        if [[ "$scope" == "global" ]]; then
            category="$DEFAULT_GLOBAL_CATEGORY"
        else
            category="$DEFAULT_PROJECT_CATEGORY"
        fi
    fi

    validate_category "$category" "$scope"

    local db
    if [[ "$scope" == "global" ]]; then
        db="$GLOBAL_DB"
    else
        db="$PROJECT_DB"
    fi

    sqlite3 "$db" "BEGIN; INSERT INTO memories (content, category) VALUES ('$(echo "$content" | sed "s/'/''/g")', '$category'); COMMIT;"

    success "Added $scope memory: $content"
    echo ""
    do_sync
}

# ─── LIST ─────────────────────────────────────────────────────────────────────
cmd_list() {
    ensure_databases
    local show_project=true
    local show_global=true

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --project) show_global=false; shift ;;
            --global)  show_project=false; shift ;;
            *)         die "Unknown flag: $1" ;;
        esac
    done

    if $show_global; then
        echo ""
        info "━━━ Global Memories ━━━"
        print_memories "$GLOBAL_DB" "Global"
    fi

    if $show_project; then
        echo ""
        info "━━━ Project Memories ━━━"
        print_memories "$PROJECT_DB" "Project"
    fi
    echo ""
}

# ─── SEARCH ───────────────────────────────────────────────────────────────────
cmd_search() {
    ensure_databases
    local scope="both"
    local term=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --global)  scope="global"; shift ;;
            --project) scope="project"; shift ;;
            *)         term="$1"; shift ;;
        esac
    done

    if [[ -z "$term" ]]; then
        die "Usage: memory.sh search [--global|--project] \"search term\""
    fi

    local escaped_term
    escaped_term="$(echo "$term" | sed "s/'/''/g")"
    local query="SELECT id, category, content, created_at FROM memories WHERE content LIKE '%${escaped_term}%' COLLATE NOCASE ORDER BY id"

    if [[ "$scope" != "project" ]]; then
        echo ""
        info "━━━ Global Results ━━━"
        print_memories "$GLOBAL_DB" "Global" "$query"
    fi

    if [[ "$scope" != "global" ]]; then
        echo ""
        info "━━━ Project Results ━━━"
        print_memories "$PROJECT_DB" "Project" "$query"
    fi
    echo ""
}

# ─── REMOVE ───────────────────────────────────────────────────────────────────
cmd_remove() {
    ensure_databases
    local scope="project"
    local id=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --global) scope="global"; shift ;;
            *)        id="$1"; shift ;;
        esac
    done

    if [[ -z "$id" ]]; then
        die "Usage: memory.sh remove [--global] ID"
    fi

    local db
    if [[ "$scope" == "global" ]]; then
        db="$GLOBAL_DB"
    else
        db="$PROJECT_DB"
    fi

    local existing
    existing="$(sqlite3 "$db" "SELECT content FROM memories WHERE id = $id" 2>/dev/null)" || true
    if [[ -z "$existing" ]]; then
        die "No $scope memory with ID $id"
    fi

    sqlite3 "$db" "BEGIN; DELETE FROM memories WHERE id = $id; COMMIT;"
    success "Removed $scope memory #$id: $existing"
    echo ""
    do_sync
}

# ─── EDIT ─────────────────────────────────────────────────────────────────────
cmd_edit() {
    ensure_databases
    local scope="project"
    local id=""
    local content=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --global) scope="global"; shift ;;
            *)
                if [[ -z "$id" ]]; then
                    id="$1"
                else
                    content="$1"
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$id" ]] || [[ -z "$content" ]]; then
        die "Usage: memory.sh edit [--global] ID \"new text\""
    fi

    local db
    if [[ "$scope" == "global" ]]; then
        db="$GLOBAL_DB"
    else
        db="$PROJECT_DB"
    fi

    local existing
    existing="$(sqlite3 "$db" "SELECT content FROM memories WHERE id = $id" 2>/dev/null)" || true
    if [[ -z "$existing" ]]; then
        die "No $scope memory with ID $id"
    fi

    local escaped_content
    escaped_content="$(echo "$content" | sed "s/'/''/g")"
    sqlite3 "$db" "BEGIN; UPDATE memories SET content = '$escaped_content', updated_at = CURRENT_TIMESTAMP WHERE id = $id; COMMIT;"

    success "Updated $scope memory #$id"
    echo -e "  ${DIM}Old:${RESET} $existing"
    echo -e "  ${BOLD}New:${RESET} $content"
    echo ""
    do_sync
}

# ─── EXPORT ───────────────────────────────────────────────────────────────────
cmd_export() {
    ensure_databases
    local scope="both"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --global)  scope="global"; shift ;;
            --project) scope="project"; shift ;;
            *)         die "Unknown flag: $1" ;;
        esac
    done

    echo "{"

    if [[ "$scope" != "project" ]]; then
        echo '  "global": ['
        local global_json
        global_json="$(sqlite3 -json "$GLOBAL_DB" "SELECT id, content, category, created_at, updated_at FROM memories ORDER BY id" 2>/dev/null)" || global_json="[]"
        echo "    $global_json"
        if [[ "$scope" == "both" ]]; then
            echo '  ],'
        else
            echo '  ]'
        fi
    fi

    if [[ "$scope" != "global" ]]; then
        echo '  "project": ['
        local project_json
        project_json="$(sqlite3 -json "$PROJECT_DB" "SELECT id, content, category, created_at, updated_at FROM memories ORDER BY id" 2>/dev/null)" || project_json="[]"
        echo "    $project_json"
        echo '  ]'
    fi

    echo "}"
}

# ─── IMPORT ───────────────────────────────────────────────────────────────────
cmd_import() {
    ensure_databases
    local scope="project"
    local file=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --global)  scope="global"; shift ;;
            --project) scope="project"; shift ;;
            *)         file="$1"; shift ;;
        esac
    done

    if [[ -z "$file" ]] || [[ ! -f "$file" ]]; then
        die "Usage: memory.sh import [--global|--project] FILE.json"
    fi

    if ! command -v python3 &>/dev/null; then
        die "python3 is required for JSON import."
    fi

    local db
    local json_key
    if [[ "$scope" == "global" ]]; then
        db="$GLOBAL_DB"
        json_key="global"
    else
        db="$PROJECT_DB"
        json_key="project"
    fi

    local count=0
    while IFS='|' read -r content category; do
        local escaped_content
        escaped_content="$(echo "$content" | sed "s/'/''/g")"
        local escaped_category
        escaped_category="$(echo "$category" | sed "s/'/''/g")"
        sqlite3 "$db" "INSERT INTO memories (content, category) VALUES ('$escaped_content', '$escaped_category');"
        ((count++))
    done < <(python3 -c "
import json, sys
data = json.load(open('$file'))
items = data if isinstance(data, list) else data.get('$json_key', data.get('memories', []))
if isinstance(items, list) and len(items) > 0 and isinstance(items[0], list):
    items = items[0]
for item in items:
    if isinstance(item, dict):
        print(item.get('content','') + '|' + item.get('category','$DEFAULT_PROJECT_CATEGORY'))
" 2>/dev/null) || die "Failed to parse JSON file"

    success "Imported $count memories into $scope database."
    echo ""
    do_sync
}

# ─── STATS ────────────────────────────────────────────────────────────────────
cmd_stats() {
    ensure_databases
    echo ""
    info "━━━ Memory Statistics ━━━"
    echo ""

    local global_count
    global_count="$(sqlite3 "$GLOBAL_DB" "SELECT COUNT(*) FROM memories" 2>/dev/null)" || global_count=0
    local global_size
    global_size="$(du -h "$GLOBAL_DB" 2>/dev/null | cut -f1)" || global_size="N/A"

    echo -e "  ${BOLD}Global memories:${RESET}  $global_count  ${DIM}(DB: $global_size)${RESET}"

    if [[ "$global_count" -gt 0 ]]; then
        local global_cats
        global_cats="$(sqlite3 "$GLOBAL_DB" "SELECT category, COUNT(*) FROM memories GROUP BY category ORDER BY category" 2>/dev/null)" || true
        if [[ -n "$global_cats" ]]; then
            while IFS='|' read -r cat cnt; do
                local colored
                colored="$(category_color "$cat")"
                echo -e "    ${colored}: $cnt"
            done <<< "$global_cats"
        fi
    fi

    echo ""

    local project_count
    project_count="$(sqlite3 "$PROJECT_DB" "SELECT COUNT(*) FROM memories" 2>/dev/null)" || project_count=0
    local project_size
    project_size="$(du -h "$PROJECT_DB" 2>/dev/null | cut -f1)" || project_size="N/A"

    echo -e "  ${BOLD}Project memories:${RESET} $project_count  ${DIM}(DB: $project_size)${RESET}"

    if [[ "$project_count" -gt 0 ]]; then
        local project_cats
        project_cats="$(sqlite3 "$PROJECT_DB" "SELECT category, COUNT(*) FROM memories GROUP BY category ORDER BY category" 2>/dev/null)" || true
        if [[ -n "$project_cats" ]]; then
            while IFS='|' read -r cat cnt; do
                local colored
                colored="$(category_color "$cat")"
                echo -e "    ${colored}: $cnt"
            done <<< "$project_cats"
        fi
    fi

    echo ""
    echo -e "  ${BOLD}Total:${RESET} $((global_count + project_count)) memories across both layers"
    echo ""
}

# ─── SYNC (public command) ────────────────────────────────────────────────────
cmd_sync() {
    do_sync
    echo ""
    success "All files synced successfully."
}

# ─── Usage ────────────────────────────────────────────────────────────────────
usage() {
    echo -e "${BOLD}memory.sh${RESET} — Persistent memory system for Claude Code"
    echo ""
    echo -e "${BOLD}Usage:${RESET}"
    echo "  memory.sh add [--global] [--category CAT] \"text\"   Add a memory"
    echo "  memory.sh list [--global|--project]                 List memories"
    echo "  memory.sh search [--global|--project] \"term\"        Search memories"
    echo "  memory.sh remove [--global] ID                      Remove by ID"
    echo "  memory.sh edit [--global] ID \"new text\"             Edit by ID"
    echo "  memory.sh sync                                      Regenerate CLAUDE.md"
    echo "  memory.sh export [--global|--project]               Export as JSON"
    echo "  memory.sh import [--global|--project] FILE          Import from JSON"
    echo "  memory.sh stats                                     Show statistics"
    echo ""
    echo -e "${BOLD}Categories:${RESET}"
    echo "  Project: decision, convention, architecture, dependency, other"
    echo "  Global:  convention, preference, pattern, other"
}

# ─── Main dispatch ────────────────────────────────────────────────────────────
if [[ $# -eq 0 ]]; then
    usage
    exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
    add)     cmd_add "$@" ;;
    list)    cmd_list "$@" ;;
    search)  cmd_search "$@" ;;
    remove)  cmd_remove "$@" ;;
    edit)    cmd_edit "$@" ;;
    sync)    cmd_sync ;;
    export)  cmd_export "$@" ;;
    import)  cmd_import "$@" ;;
    stats)   cmd_stats ;;
    help|-h|--help) usage ;;
    *)       die "Unknown command: $COMMAND. Run 'memory.sh help' for usage." ;;
esac
