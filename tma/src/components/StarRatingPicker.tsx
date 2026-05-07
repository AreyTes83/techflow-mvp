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
                    color: '#fde68a',
                    borderColor: 'rgba(251, 191, 36, 0.55)',
                    background: 'linear-gradient(145deg, rgba(251,191,36,0.22), rgba(245,158,11,0.12))',
                    boxShadow: '0 10px 30px -20px rgba(251,191,36,0.65)',
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
