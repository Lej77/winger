// Objects, functions and types used across popup/*.js.

import { NameMap, validify } from '../name.js';

/** @import { WindowId, BNodeId } from '../types.js' */
/** @import { PopupConfig } from '../storage.js' */

/**
 * Window row element.
 * @typedef {_WindowRow$ & IdStore & HTMLElement} WindowRow$
 * @typedef _WindowRow$
 * @property {number} [_nameLength]
 * @property {WindowRowCell & HTMLButtonElement} [$send]
 * @property {WindowRowCell & HTMLButtonElement} [$bring]
 * @property {NameField$} $name
 * @property {WindowRowCell & HTMLElement} [$tabCount]
 * @property {WindowRowCell & HTMLButtonElement} [$stash]
 */
/** @typedef {WindowRowCell & IdStore & HTMLInputElement} NameField$ */
/** @typedef {{ _id?: WindowId | BNodeId }} IdStore */
/** @typedef {{ $row: WindowRow$ }} WindowRowCell */

// Elements of the popup //

/** @type {HTMLBodyElement} */ export const $body = document.body;
/** @type {WindowRow$} */ export const $currentWindowRow = document.getElementById('currentWindow');
/** @type {WindowRow$} */ export const $newWindowRow = document.getElementById('newWindow'); // Initially outside `$otherWindowsList` and therefore NOT in the "full snapshot"
/** @type {HTMLInputElement} */ export const $omnibox = document.getElementById('omnibox');
/** @type {HTMLElement} */ export const $otherWindowsList = $body.querySelector('window-list');
/** @type {HTMLElement} */ export const $toolbar = $body.querySelector('footer');
/** @type {HTMLElement} */ export const $status = $toolbar.querySelector('status-bar');

// Populated at init //

/** @type {PopupConfig} */
export const FLAGS = {};

/** @type {NameField$[] & { $stashed: NameField$[] & { _startIndex: number } }} */
export const $names = [];

/**
 * Original order of only window-rows, unlike `$otherWindowsList.children` whose order can change and may contain window-headings.
 * `$withHeadings` has all rows and headings in original order.
 * @type {WindowRow$[] & {
 *     $headingMinimized: HTMLElement,
 *     $stashed?: WindowRow$[] & { _startIndex: number },
 *     $headingStashed?: HTMLElement,
 *     $withHeadings: (WindowRow$ & HTMLElement)[],
 * }}
 */
export const $otherWindowRows = [];

// Element type //

/** @param {HTMLElement?} $el @returns {boolean} */ export const isButton = $el => $el?.tagName === 'BUTTON';
/** @param {HTMLElement?} $el @returns {boolean} */ export const isField = $el => $el?.tagName === 'INPUT';
/** @param {HTMLElement?} $el @returns {boolean} */ export const isNameField = $el => $el?.classList.contains('name');
/** @param {HTMLElement?} $el @returns {boolean} */ export const isRow = $el => $el?.tagName === 'WINDOW-ROW';
/** @param {HTMLElement?} $el @returns {boolean} */ export const isInToolbar = $el => $el?.parentElement === $toolbar;

// Name map //

/**
 * @type {NameMap & {
 *     ready: () => NameMap,
 *     validUniqueName: (name: string) => string,
 * }}
 */
export const nameMap = new NameMap();
nameMap.ready = () => nameMap.size ? nameMap : nameMap.populate($names);
nameMap.validUniqueName = name => nameMap.uniquify(validify(name));
