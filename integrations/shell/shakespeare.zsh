# Shakespeare zsh integration.
#
# Source this file from ~/.zshrc, then press the configured key while editing a
# command line to rewrite the current BUFFER through the Shakespeare backend.

: "${SHAKESPEARE_COMPILE_BIN:=${0:A:h:h:h}/scripts/compile-prompt.mjs}"
: "${SHAKESPEARE_ZSH_KEY:=^X^P}"

function shakespeare-compile-buffer() {
  emulate -L zsh

  local original_buffer="$BUFFER"
  if [[ -z "${original_buffer//[[:space:]]/}" ]]; then
    zle -M "Shakespeare: buffer is empty"
    return 0
  fi

  if [[ ! -f "$SHAKESPEARE_COMPILE_BIN" ]]; then
    zle -M "Shakespeare: compile helper not found"
    return 1
  fi

  zle -M "Shakespeare: rewriting..."

  local optimized
  optimized="$(
    printf '%s' "$original_buffer" | \
      node "$SHAKESPEARE_COMPILE_BIN" \
        --active-app "zsh" \
        --window-title "${PWD}" \
        --mode "${SHAKESPEARE_PROMPT_MODE:-coding_agent}" \
        --optimization "${SHAKESPEARE_OPTIMIZATION_MODE:-speed}"
  )"

  if [[ -z "$optimized" ]]; then
    zle -M "Shakespeare: no rewrite returned"
    return 1
  fi

  BUFFER="$optimized"
  CURSOR=${#BUFFER}
  zle redisplay
  zle -M "Shakespeare: prompt rewritten"
}

zle -N shakespeare-compile-buffer
bindkey "$SHAKESPEARE_ZSH_KEY" shakespeare-compile-buffer
