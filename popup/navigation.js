import {
    $newWindowRow,
    $currentWindowRow,
    $omnibox,
    $otherWindowsList,
    $toolbar,
    isButton,
    isRow,
    isField,
    isInToolbar,
    isNameField,
    FLAGS,
} from './common.js';
import { isActive as isEditMode } from './editmode.js';
import { $shownRows } from './filter.js';

/** @import { WindowRow$ } from './common.js' */
/** @typedef {string} Key */

/**
 * @callback KeyProcessor
 * @param {HTMLElement} $el
 * @param {KeyboardEvent} event
 * @returns {HTMLElement}
 */

const HORIZONTAL_KEYS = ['ArrowRight', 'ArrowLeft'];
const VERTICAL_KEYS = ['ArrowDown', 'ArrowUp'];

/** @param {HTMLElement} $el @returns {boolean} */ const isUnfocusable = $el => row($el).hidden || $el.tabIndex === -1;
/** @param {Key} key @returns {boolean} */         const isHorizontalKey = key => HORIZONTAL_KEYS.includes(key);
/** @param {Key} key @returns {boolean} */         const isVerticalKey = key => VERTICAL_KEYS.includes(key);

/**
 * Upon an arrow or tab keydown, focus on the next focusable element in that direction and return true.
 * Control vertical scrolling.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function handleKeyDown(event) {
    /** @type {Key} */ const key = event.key;
    /** @type {HTMLElement} */ let $el = event.target;

    if (isHorizontalKey(key) && isField($el) && !$el.readOnly)
        return false;

    const navigatorKey = Navigator[key];
    if (!navigatorKey)
        return false;

    // Repeat in same direction until focusable element found
    do {
        $el = navigatorKey($el, event);
    } while (isUnfocusable($el));

    isVerticalKey(key)
        ? restrictScroll($el, event)
        : Column.set($el);

    $el.focus();
    $el.select?.();
    return true;
}

/**
 * @param {KeyboardEvent} event
 * @returns {boolean?}
 */
export function handleKeyUp(event) {
    if (event.key === 'Tab') {
        Column.set(event.target);
        return true;
    }
}

/**
 * Scrolling is suppressed unless focused row is this number of rows from the start or end.
 * @type {[normal: number, compact: number] | number}
 */
let scrollThreshold = [5, 8];

/**
 * Prevent scrolling if focus is on first/last few rows, to control the default scoll-ahead.
 * @param {HTMLElement} $el
 * @param {KeyboardEvent} event
 */
function restrictScroll($el, event) {
    if (Array.isArray(scrollThreshold))
        scrollThreshold = scrollThreshold[+FLAGS.compact_popup];
    const index = $shownRows.indexOf(row($el));
    if (index < scrollThreshold || ($shownRows.length - index) <= scrollThreshold)
        event.preventDefault(); // Suppress scrolling
}

/**
 * @type {Object<Key, KeyProcessor>}
 */
const Navigator = {

    /** @type {KeyProcessor} */
    ArrowDown($el) {
        if (isInToolbar($el))
            return currentWindow();
        if (isCurrentWindow($el))
            return $omnibox;
        if (isOmnibox($el))
            return rowOrCell($otherWindowsList.firstElementChild) || toolbar();
        return rowOrCell(row($el).nextElementSibling) || toolbar();
    },

    /** @type {KeyProcessor} */
    ArrowUp($el) {
        if (isOmnibox($el))
            return currentWindow();
        if (isCurrentWindow($el))
            return toolbar();
        if (isInToolbar($el))
            return rowOrCell($otherWindowsList.lastElementChild) || $omnibox;
        return rowOrCell(row($el).previousElementSibling) || $omnibox;
    },

    /** @type {KeyProcessor} */
    ArrowRight($el) {
        if (isOmnibox($el))
            return $omnibox;
        if (isEditMode && isField($el))
            return $el;
        if (isInToolbar($el))
            return $el.nextElementSibling || $toolbar.querySelector('button');
        return isRow($el) ? $el.firstElementChild :
            ($el.nextElementSibling || $el.$row);
    },

    /** @type {KeyProcessor} */
    ArrowLeft($el) {
        if (isOmnibox($el))
            return $omnibox;
        if (isEditMode && isField($el))
            return $el;
        if (isInToolbar($el))
            return $el.previousElementSibling || $toolbar.querySelector('button:last-child');
        return isRow($el) ? $el.lastElementChild :
            ($el.previousElementSibling || $el.$row);
    },

    /** @type {KeyProcessor} */
    Tab($el, event) {
        if (event.shiftKey) {
            if (isCurrentWindow($el)) {
                event.preventDefault();
                return toolbar();
            }
            if (isEditMode && isNameField($el)) {
                const $row = $el.$row;
                if ($row === $shownRows[0]) {
                    event.preventDefault();
                    return $omnibox;
                }
                return $row.previousElementSibling.$name;
            }
            return $el;
        }
        if (isInToolbar($el)) {
            event.preventDefault();
            return currentWindow();
        }
        if (isEditMode) {
            if (isOmnibox($el)) {
                event.preventDefault();
                return $shownRows[0]?.$name || toolbar();
            }
            if (isNameField($el)) {
                const $row = $el.$row;
                if ($row !== $currentWindowRow && $row !== $shownRows.at(-1)) {
                    // A name field that is not the first or last
                    event.preventDefault();
                    return $row.nextElementSibling.$name;
                }
            }
        }
        return $el;
    },

}

const Column = {
    /**
     * Currently-focused button column e.g. "send", "bring".
     * @type {string?}
     */
    current: null,

    /**
     * @param {HTMLElement} $el
     */
    set($el) {
        if (isRow($el) || isField($el))
            Column.current = null;
        else
        if (isButton($el)) {
            const action = $el.dataset.action;
            Column.current = (action === 'togglePrivate') ? 'stash' : action;
        }
    },

    /**
     * Return cell at given row and current column.
     * @param {WindowRow$?} $row
     * @returns {HTMLElement?}
     */
    getCell($row) {
        if ($row === $newWindowRow && Column.current === 'stash')
            return $newWindowRow.$togglePrivate;
        /** @type {HTMLElement?} */
        const $cell = $row?.['$' + Column.current];
        if ($cell && !$cell.disabled)
            return $cell;
    },
}

/**
 * Take and return row, unless a cell can be returned instead.
 * Uses {boolean} `isEditMode`
 * @param {WindowRow$} $row
 * @returns {WindowRow$ | HTMLElement}
 */
const rowOrCell = $row => isEditMode && $row?.$name || Column.getCell($row) || $row;

/**
 * Element's parent row, else assume element is a row.
 * @param {HTMLElement} $el
 * @returns {WindowRow$}
 */
const row = $el => $el.$row || $el;

/** @returns {HTMLElement} */ const currentWindow = () => Column.getCell($currentWindowRow) || $currentWindowRow.$name || $currentWindowRow;
/** @returns {HTMLElement} */ const toolbar = () => $toolbar.querySelector('button') || $toolbar;

/** @param {HTMLElement} $el @returns {boolean} */ const isCurrentWindow = $el => row($el) === $currentWindowRow;
/** @param {HTMLElement} $el @returns {boolean} */ const isOmnibox = $el => $el === $omnibox;
