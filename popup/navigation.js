import { $currentWindowRow, $omnibox, $toolbar, isButton, isRow, getActionAttr } from './common.js';
import { $shownRows } from './filter.js';

const SCROLL_THRESHOLD = 5; // Scrolling is suppressed unless focused row is this number of rows from the start or end

// Given an element and an arrow key, focus on the next focusable element in that direction and return true.
// Return null if key not an arrow key.
// Control vertical scrolling.
export default function navigateByArrow($el, key, event) {
    const navigatorKey = navigator[key];
    if (!navigatorKey) return;

     // Repeat in same direction until focusable element found
    do { $el = navigatorKey($el) } while (isUnfocusable($el));

    if (isVerticalKey(key)) {
        restrictScroll($el, event);
    } else {
        setColumn($el);
    }

    $el.focus();
    return true;
}

const isUnfocusable = $el => $el.hidden || $el.tabIndex === -1;
const isVerticalKey = key => ['ArrowDown', 'ArrowUp'].includes(key);

function restrictScroll($el, event) {
    const index = row($el)._index;
    if (SCROLL_THRESHOLD <= index && ($shownRows.length - index) > SCROLL_THRESHOLD) return;
    event.preventDefault(); // Suppress scrolling
}

let column; // Currently-focused button column
function setColumn($el) {
    column =
        isRow($el) ? null : // if row: null
        isButton($el) ? getActionAttr($el) : // if cell: its action reference ("send", etc)
        column; // no change
}

const navigator = {
    ArrowDown($el) {
        if (isToolbar($el)) return currentWindow();
        if (isCurrentWindow($el)) return $omnibox;
        if ($el === $omnibox) return rowOrCell($shownRows[0]) || toolbar();
        const $nextRow = $shownRows[row($el)._index + 1];
        return rowOrCell($nextRow) || toolbar();
    },
    ArrowUp($el) {
        if ($el === $omnibox) return currentWindow();
        if (isCurrentWindow($el)) return toolbar();
        if (isToolbar($el)) return rowOrCell($shownRows[$shownRows.length - 1]) || $omnibox;
        const $nextRow = $shownRows[row($el)._index - 1];
        return rowOrCell($nextRow) || $omnibox;
    },
    ArrowRight($el) {
        if ($el === $omnibox) return $omnibox;
        if (isToolbar($el)) return $el.nextElementSibling || $toolbar.firstElementChild;
        return isRow($el) ? $el.firstElementChild : ($el.nextElementSibling || $el.$row);
    },
    ArrowLeft($el) {
        if ($el === $omnibox) return $omnibox;
        if (isToolbar($el)) return $el.previousElementSibling || $toolbar.lastElementChild;
        return isRow($el) ? $el.lastElementChild : ($el.previousElementSibling || $el.$row);
    },
};


// Take and return the same row, unless a cell can be returned instead.
function rowOrCell($row) {
    return $row?.[`$${column}`] || $row;
}

// Element's parent row, else assume element is a row.
function row($el) {
    return $el.$row || $el;
}

// Return the appropriate cell in currentWindowRow, else return row itself.
function currentWindow() {
    let $cell = $currentWindowRow[`$${column}`];
    if ($cell) return $cell;
    $cell = $currentWindowRow.firstElementChild;
    while ($cell && isUnfocusable($cell)) {
        $cell = $cell.nextElementSibling;
    }
    return $cell || $currentWindowRow;
}

function toolbar() {
    return $toolbar.firstElementChild || $toolbar;
}

function isCurrentWindow($el) {
    return $el.$row === $currentWindowRow || $el === $currentWindowRow;
}

function isToolbar($el) {
    return $el.parentElement === $toolbar || $el === $toolbar;
}
