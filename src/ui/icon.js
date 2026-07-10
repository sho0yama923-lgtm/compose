const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const ICONS = {
    add: [
        ['path', { d: 'M12 5v14M5 12h14' }],
    ],
    edit: [
        ['path', { d: 'M4 16.5V20h3.5L18.3 9.2l-3.5-3.5L4 16.5Z' }],
        ['path', { d: 'm13.8 6.7 3.5 3.5' }],
    ],
    menu: [
        ['path', { d: 'M4 7h16M4 12h16M4 17h16' }],
    ],
    more: [
        ['circle', { cx: '12', cy: '5', r: '1.2', fill: 'currentColor', stroke: 'none' }],
        ['circle', { cx: '12', cy: '12', r: '1.2', fill: 'currentColor', stroke: 'none' }],
        ['circle', { cx: '12', cy: '19', r: '1.2', fill: 'currentColor', stroke: 'none' }],
    ],
    next: [
        ['path', { d: 'm7 5 8 7-8 7V5Z', fill: 'currentColor', stroke: 'none' }],
        ['path', { d: 'M18 5v14' }],
    ],
    pause: [
        ['path', { d: 'M7 5h3v14H7zM14 5h3v14h-3z', fill: 'currentColor', stroke: 'none' }],
    ],
    play: [
        ['path', { d: 'm8 5 10 7-10 7V5Z', fill: 'currentColor', stroke: 'none' }],
    ],
    previous: [
        ['path', { d: 'm17 5-8 7 8 7V5Z', fill: 'currentColor', stroke: 'none' }],
        ['path', { d: 'M6 5v14' }],
    ],
    trash: [
        ['path', { d: 'M5 7h14M10 3h4l1 2H9l1-2ZM7 7l1 13h8l1-13M10 10v7M14 10v7' }],
    ],
};

export function createIcon(name, { className = '' } = {}) {
    const shapes = ICONS[name];
    if (!shapes) throw new Error(`Unknown UI icon: ${name}`);

    const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
    icon.classList.add('ui-icon', `ui-icon-${name}`);
    if (className) icon.classList.add(...className.split(' ').filter(Boolean));
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.9');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');

    shapes.forEach(([tagName, attributes]) => {
        const shape = document.createElementNS(SVG_NAMESPACE, tagName);
        Object.entries(attributes).forEach(([key, value]) => shape.setAttribute(key, value));
        icon.appendChild(shape);
    });
    return icon;
}
