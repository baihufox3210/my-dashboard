type UiIconName = 'plus' | 'edit' | 'trash' | 'refresh' | 'external' | 'back'

const paths: Record<UiIconName, string> = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 8.5l3 3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  back: 'M19 12H5M11 6l-6 6 6 6',
}

function UiIcon({ name }: { name: UiIconName }) {
  return <svg className="ui-button-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}

export default UiIcon
