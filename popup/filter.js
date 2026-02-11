import {
    $body,
    $otherWindowsList,
    $otherWindowRows,
    $newWindowRow,
    nameMap,
} from './common.js';
import { isActive as isEditMode } from './editmode.js';

/** @import { WindowRow$ } from './common.js' */

/**
 * Currently visible other-window rows.
 * @type {WindowRow$[]}
*/
export const $shownRows = [];

export let isFiltered = false;

/**
 * Show only other-window rows whose names contain `query`, and sort them by name length, shortest first.
 * Name the new-window row as `query` and show it.
 * If `query === ''`, reset rows.
 * @param {string} query
 */
export function execute(query) {
    query = query.trim();
    if (query) {
        (filter(query) > 1) && sortShown(); // Filter, then sort results if there's more than one
        showNew(query);
    } else {
        reset();
    }
    isFiltered = !!query;
    $body.classList.toggle('filtered', isFiltered);
}

/**
 * Hide window rows whose names do not contain `query`, case-insensitive. The rest are shown and given `_nameLength` property.
 * @param {string} query
 * @returns {number} Count of shown rows
 */
function filter(query) {
    $shownRows.length = 0;
    const queryUC = query.toUpperCase();
    for (const $row of $otherWindowRows) {
        const nameOrTitleUC = getNameOrTitle($row).toUpperCase();
        const isMatch = nameOrTitleUC.includes(queryUC);
        $row.hidden = !isMatch;
        if (isMatch) {
            $row._nameLength = nameOrTitleUC.length;
            $shownRows.push($row);
        }
    }
    return $shownRows.length;
}

/**
 * @param {WindowRow$} $row
 * @returns {string}
 */
function getNameOrTitle($row) {
    const $name = $row.$name;
    return $name.value || $name.placeholder;
}

/** Sort shown rows by name length, shortest first. */
function sortShown() {
    $shownRows.sort(($a, $b) => $a._nameLength - $b._nameLength);
    for (const $row of $shownRows)
        $otherWindowsList.appendChild($row);
}

/** Update and, if not in edit mode, show the new-window row. */
function showNew(query) {
    $otherWindowsList.appendChild($newWindowRow);
    $newWindowRow.$name.value = nameMap.ready().validUniqueName(query);
    $newWindowRow.hidden = isEditMode;
}

/**
 * Hide new-window row.
 * Show all other-window rows in the correct order.
 */
function reset() {
    if (!isFiltered)
        return;
    $newWindowRow.hidden = true;
    // Restore sort order of 'live' `$otherWindowsList.children` by comparing against correctly-sorted `$otherWindowRows.$withHeadings`
    $otherWindowRows.$withHeadings.forEach(($correctRow, index) => {
        $correctRow.hidden = false;
        const $row = $otherWindowsList.children[index];
        if ($row !== $correctRow)
            $otherWindowsList.insertBefore($correctRow, $row); // Move correct row to incorrect row's location
    });
    $shownRows.length = 0;
    $shownRows.push(...$otherWindowRows);
    $otherWindowsList.scroll(0, 0);
}
