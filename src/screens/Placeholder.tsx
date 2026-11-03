/** Stands in for a tab whose screen is not built yet. */
export function Placeholder({ title, text }: { title: string; text: string }) {
	return (
		<header className="head">
			<h1>{title}</h1>
			<p className="lead">{text}</p>
		</header>
	);
}
