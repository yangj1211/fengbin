import type { ModuleId } from './model';

// A shared circuit motif and five business-specific vector marks. Decorative
// artwork stays independent of application data and does not imply live status.
export default function AgentArtwork({ id }: { id: ModuleId }) {
  return (
    <div className="plaza-agent-artwork" aria-hidden="true">
      <svg className="plaza-agent-circuit" viewBox="0 0 360 170" fill="none">
        <g className="plaza-circuit-traces" strokeWidth="1">
          <path d="M0 54h80l28 31h25M0 118h67l24-24h42M360 52h-70l-28 32h-35M360 124h-81l-24-30h-28" />
          <circle cx="180" cy="85" r="68" />
          <path d="M149 18h62M149 152h62" />
        </g>
        <g className="plaza-circuit-nodes" strokeWidth="1.5">
          <circle cx="76" cy="54" r="4" />
          <circle cx="66" cy="118" r="3" />
          <circle cx="289" cy="52" r="3" />
          <circle cx="279" cy="124" r="4" />
        </g>
        <path
          className="plaza-circuit-signal"
          d="M101 68l15 17h17M259 99l-4-5h-28"
          strokeWidth="2"
        />
      </svg>
      <svg className="plaza-agent-emblem" viewBox="0 0 96 96" fill="none">
        <path
          className="plaza-emblem-edge"
          d="M19 5h58l14 14v58L77 91H19L5 77V19Z"
        />
        <path
          className="plaza-emblem-face"
          d="M22 10h52l12 12v52L74 86H22L10 74V22Z"
        />
        <g
          transform="translate(16 16)"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {id === 'customer' ? (
            <>
              <rect x="9" y="13" width="29" height="38" rx="6" />
              <path d="M18 24v16m10-16v16M14 32h4m10 0h6" />
              <path
                className="plaza-glyph-fill"
                d="m46 24 12 7v14l-12 7-12-7V31Z"
              />
              <path d="m41 38 4 4 7-8" />
            </>
          ) : id === 'maintenance' ? (
            <>
              <path d="M38 13a12 12 0 0 0-15 15L11 40a6 6 0 0 0 8 8l12-12a12 12 0 0 0 15-15l-8 8-7-7Z" />
              <circle
                cx="16"
                cy="44"
                r="1.5"
                fill="currentColor"
                stroke="none"
              />
              <path d="M44 45h12m-6-6v12" />
            </>
          ) : id === 'energy' ? (
            <>
              <path
                d="M34 8 17 34h13l-2 21 21-31H35Z"
                className="plaza-glyph-accent"
              />
              <path d="M13 18a25 25 0 0 0-3 24m41 4a25 25 0 0 0 3-24" />
              <circle cx="13" cy="18" r="2" fill="currentColor" stroke="none" />
              <circle cx="51" cy="46" r="2" fill="currentColor" stroke="none" />
            </>
          ) : id === 'production' ? (
            <>
              <path d="M10 54h44" />
              <rect x="12" y="37" width="7" height="12" rx="2" />
              <rect x="28" y="29" width="7" height="20" rx="2" />
              <rect
                x="44"
                y="19"
                width="7"
                height="30"
                rx="2"
                className="plaza-glyph-accent"
              />
              <path d="m10 27 14-10 10 4L51 8m-9 0h9v9" />
            </>
          ) : (
            <>
              <path d="m32 9 19 8v15c0 11-8 18-19 23-11-5-19-12-19-23V17Z" />
              <path d="m23 32 7 7 12-14" />
              <path d="M7 24H2m60 0h-5M7 42H2m60 0h-5" />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
