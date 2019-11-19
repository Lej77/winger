import * as EditMode from './editmode.js';

const $currentWindowRow = document.getElementById('currentWindow');
const $omnibar = document.getElementById('omnibar');
const $windowList = document.getElementById('windowList');
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
let metaWindows = {};

browser.runtime.sendMessage({ popup: true }).then(init);
$windowList.addEventListener('click', onClickRow);
$omnibar.addEventListener('keyup', onOmnibarInput);


function init(response) {
    metaWindows = response.metaWindows;
    const focusedWindowId = response.focusedWindowId;
    const sortedIds = response.sortedIds;
    for (const windowId of sortedIds) {
        const metaWindow = metaWindows[windowId];
        if (windowId == focusedWindowId) {
            populateRow($currentWindowRow, metaWindow);
        } else {
            addRow(metaWindow);
        }
    }
}

function addRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);
    populateRow($row, metaWindow);
    $windowList.appendChild($row);
}

function populateRow($row, metaWindow) {
    const $input = $row.querySelector('input');
    const $badge = $row.querySelector('.badge');
    $input.value = metaWindow.givenName;
    $input.placeholder = metaWindow.defaultName;
    $badge.textContent = metaWindow.tabCount;
    $row._id = $input._id = metaWindow.id;
}

function onClickRow(event) {
    if (EditMode.active) return;
    const $target = event.target;
    const $row = $target.closest('tr');
    if ($row) {
        goalAction(event, $row._id, !!$target.closest('.sendTabAction'));
    }
}

function onOmnibarInput(event) {
    const str = $omnibar.value;
    const $firstMatchRow = filterRows(str);
    if (event.key == 'Enter' && $firstMatchRow) {
        goalAction(event, $firstMatchRow._id);
    }
}

// Hide rows whose names do not contain string. Returns first matching row or null.
function filterRows(str) {
    const $rows = $windowList.rows;
    let $firstMatchRow;
    if (str) {
        for (const $row of $rows) {
            const isMatch = metaWindows[$row._id].displayName.includes(str);
            $row.hidden = !isMatch;
            $firstMatchRow = $firstMatchRow || (isMatch ? $row : null); // if not already found, it's this row
        }
    } else {
        for (const $row of $rows) {
            $row.hidden = false;
        }
        $firstMatchRow = $rows[0];
    }
    return $firstMatchRow;
}

function goalAction(event, windowId, sendTabsByDefault) {
    browser.runtime.sendMessage({
        module: 'BrowserOp',
        prop: 'goalAction',
        args: [windowId, getModifiers(event), sendTabsByDefault],
    });
    window.close();
}

function getModifiers(event) {
    let modifiers = [];
    for (const prop in event) {
        if (prop.endsWith('Key') && event[prop]) {
            let modifier = prop[0].toUpperCase() + prop.slice(1, -3);
            modifiers.push(modifier);
        }
    }
    return modifiers;
}
