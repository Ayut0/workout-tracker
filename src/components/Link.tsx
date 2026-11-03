import type { ComponentProps } from "react";
import { navigate } from "../lib/navigation";
import { isPlainClick } from "../lib/routes";

type LinkProps = Omit<ComponentProps<"a">, "href"> & { to: string };

/** An in-app link: a real <a href> so modified clicks and long-press work, routed without a reload. */
export function Link({ to, onClick, ...rest }: LinkProps) {
	return (
		<a
			{...rest}
			href={to}
			onClick={(e) => {
				onClick?.(e);
				if (!isPlainClick(e)) return;
				e.preventDefault();
				navigate(to);
			}}
		/>
	);
}
