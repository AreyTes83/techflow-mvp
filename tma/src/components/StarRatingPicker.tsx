/** Обрати значення від 1 до зірочок включно з вибраної. */

type Props = {
  value: number
  onChange: (stars: number) => void
  disabled?: boolean
}

export function StarRatingPicker({ value, onChange, disabled }: Props) {
  return (
    <div
      role="group"
      aria-label="Оцінка від 1 до 5"
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 6 }}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value >= n
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            className={active ? '' : 'ghost'}
            aria-label={`Зірочок: ${n}`}
            aria-pressed={active}
            onClick={() => onChange(n)}
            style={
              active
                ? {
                    color: '#b45309',
                    borderColor: 'rgba(180,83,9,0.45)',
                    background: 'rgba(251,191,36,0.15)',
                  }
                : undefined
            }
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
