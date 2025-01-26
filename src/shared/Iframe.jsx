export default function Iframe({source}) {
    if (!source) return null

    return <iframe
        src={source}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Webapp Preview"
    />
}