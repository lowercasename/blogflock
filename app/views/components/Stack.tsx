interface Props {
    items: unknown[];
}

export function Stack({ items }: Props) {
    return (
        <ul className="flex flex-col divide-y divide-gray-200 border border-gray-200 rounded">
            {items.length
                ? items.map((item, index) => (
                    <li className="py-2 px-4" key={index}>{item}</li>
                ))
                : (
                    <li className="py-2 px-4 text-gray-500 text-center bg-gray-100 text-sm">
                        Nothing here.
                    </li>
                )}
        </ul>
    );
}
