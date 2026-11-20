import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useTable, useSortBy, usePagination } from 'react-table';
import { fetchDocuments } from '../services/apiServiceDocuments.js';
import { useAuth } from '../AuthContext.js';
import {
  CornerDownRight, ChevronDown, ChevronUp, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, BadgeInfo, Circle, Filter,
  MapPin, Text, Bold, BarChart, Hash, X, ArrowRightToLine, ArrowLeftToLine, Loader2
} from 'lucide-react';
import { useTranslation } from "react-i18next";
import { TableSkeletonRows } from '../utils/setTableSkleton.js';

import Select from 'react-select';
import makeAnimated from 'react-select/animated';
const animatedComponents = makeAnimated();

// SD-514: the equipments tree (Equipments page and step 1 of Create Ticket), loaded with api/ProjectView/SearchPaged.
// - Root equipments are loaded in blocks of BLOCK_SIZE, sorted by the API; pages are cut from the cached blocks.
// - Children are loaded when a row is expanded (CHILD_PAGE_SIZE at a time, "show more" for the rest).
// - With filters the API returns the roots that match or have a matching descendant, with the branches leading to
//   the matches: those branches are expanded; rows that only lead to a match (no match themselves) are dimmed.
// - The location filter searches the root equipments on the server (api/ProjectView/LocationHints).
// Everything is cached per filters + archived + sort while the component is mounted.
const PAGE_SIZES = [12, 24, 36, 48];
const BLOCK_SIZE = 144; // divisible by every page size, so a page always fits in one block
const CHILD_PAGE_SIZE = 500;
const HINT_MIN_LENGTH = 3;
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

// Table column id -> sort column of ProjectView/SearchPaged
const SORT_COLUMNS = {
  name: 'name',
  db_address_street: 'address',
  equipment_family_name: 'type',
  customer_reference: 'customer_reference',
  equipment_brand_name: 'brand',
  equipment_model_name: 'model',
  serial_number: 'serial_number',
  barcode: 'barcode',
  project_status_name: 'status',
};

const EMPTY_FILTERS = {
  location: "",
  locationLabel: "",
  keyword: "",
  brand: EMPTY_GUID,
  model: EMPTY_GUID,
  status: EMPTY_GUID,
};

const isFiltered = (f) =>
  !!f.location || f.keyword.trim() !== "" || f.brand !== EMPTY_GUID || f.model !== EMPTY_GUID || f.status !== EMPTY_GUID;

const toApiRequest = (f, includeArchived) => ({
  keyword: f.keyword.trim(),
  brand_id: f.brand !== EMPTY_GUID ? f.brand : null,
  model_id: f.model !== EMPTY_GUID ? f.model : null,
  status_id: f.status !== EMPTY_GUID ? f.status : null,
  location_id: f.location || null,
  include_archived: includeArchived,
});

const toOptions = (list) => (Array.isArray(list) ? list : [])
  .map(item => ({ value: item.id, label: item.name }))
  .sort((a, b) => (a.label || '').localeCompare(b.label || ''));

// Status badge color: the color of the status set in the back office (project_status.color_text, hex without '#');
// when it is empty or invalid, green for an active status and gray for a closed (archived) one.
const STATUS_ACTIVE_COLOR = '#16a34a';
const STATUS_CLOSED_COLOR = '#6b7280';
const statusColor = (row) => {
  const hex = (row.project_status_color_text || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${hex.split('').map(c => c + c).join('')}`;
  return row.project_status_is_closed ? STATUS_CLOSED_COLOR : STATUS_ACTIVE_COLOR;
};

const hintLabel = (h) => {
  const name = h.name ? `${h.name} -` : '';
  return [name, h.db_address_street, h.db_address_street_number, h.db_address_street2, h.db_address_city, h.db_address_zip]
    .filter(Boolean)
    .join(' ');
};

const selectStyles = {
  control: (base) => ({
    ...base,
    border: 'none',
    boxShadow: 'none', // also remove focus ring
  }),
  option: (base, state) => ({
    ...base,
    whiteSpace: "nowrap", // prevent wrapping
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: state.isSelected
      ? 'rgb(var(--color-primary-foreground) / var(--tw-bg-opacity, 1))'
      : state.isFocused
        ? 'rgb(var(--color-primary-foreground) / var(--tw-bg-opacity, 1))'
        : 'rgb(var(--color-primary) / var(--tw-bg-opacity, 1))',
    backgroundColor: state.isSelected
      ? 'rgb(var(--color-primary) / 0.7)'
      : state.isFocused
        ? 'rgb(var(--color-primary) / 0.5)'
        : 'transparent',
    cursor: 'pointer',
  }),
  menu: (provided) => ({
    ...provided,
    width: '85%', // controls dropdown menu width
  }),
};

/**
 * Archived checkbox, filter popup and the paged equipments tree.
 * @param onRowClick  called with the clicked row (an equipment_list_item of SearchPaged)
 * @param title       optional title shown above the table
 * @param helpText    text of the blue info bar above the table
 */
const EquipmentTreeTable = ({ onRowClick, title, helpText }) => {
  const { auth } = useAuth();
  const authKey = auth?.authKey;
  const { t } = useTranslation('equipmentList');
  const { t: tCommon } = useTranslation('common');

  const [roots, setRoots] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Applied filters (Search button) and the ones being edited in the popup
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [tempFilters, setTempFilters] = useState(EMPTY_FILTERS);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tree: expanded rows, rows whose children are loading, and a counter to re-render when the cache changes
  const [expanded, setExpanded] = useState(() => new Set());
  const [loadingChildren, setLoadingChildren] = useState(() => new Set());
  const [, setCacheVersion] = useState(0);

  const [locationHints, setLocationHints] = useState([]);
  const [hintsLoading, setHintsLoading] = useState(false);
  const hintTimer = useRef(null);
  const hintSeq = useRef(0);

  const [fetchBrands, setFetchBrands] = useState();
  const [fetchModels, setFetchModels] = useState();
  const [fetchStatuses, setFetchStatuses] = useState();

  // ---- filter popup lists (loaded once, when the popup is first opened) ----------------------------------------

  useEffect(() => {
    if (!isModalOpen) return;
    const load = async (url, current, setter) => {
      if (current) return;
      try {
        const res = await fetchDocuments(url, 'GET', authKey);
        setter(res.value);
      } catch (err) {
        console.error(`Failed to load ${url}`, err);
      }
    };
    load('api/EquipmentBrand', fetchBrands, setFetchBrands);
    load('api/EquipmentModel', fetchModels, setFetchModels);
    load('api/ProjectStatus', fetchStatuses, setFetchStatuses);
  }, [isModalOpen, authKey, fetchBrands, fetchModels, fetchStatuses]);

  const brandOptions = useMemo(() => toOptions(fetchBrands), [fetchBrands]);
  const statusOptions = useMemo(() => toOptions(fetchStatuses), [fetchStatuses]);
  const modelOptions = useMemo(() => toOptions(
    Array.isArray(fetchModels)
      ? fetchModels.filter(model => tempFilters.brand === EMPTY_GUID || model.equipment_brand_id === tempFilters.brand)
      : []
  ), [fetchModels, tempFilters.brand]);

  // ---- location hints (searched on the server) ---------------------------------------------------------------

  const handleLocationChange = (e) => {
    const value = e.target.value;
    // typing replaces the picked location: a location is only applied when a hint is picked
    setTempFilters(prev => ({ ...prev, locationLabel: value, location: "" }));

    clearTimeout(hintTimer.current);
    const seq = ++hintSeq.current;
    if (value.trim().length < HINT_MIN_LENGTH) {
      setLocationHints([]);
      setHintsLoading(false);
      return;
    }
    // the spinner shows from the first key press (debounce included) until the latest search answers
    setHintsLoading(true);
    hintTimer.current = setTimeout(async () => {
      try {
        const url = `api/ProjectView/LocationHints?keyword=${encodeURIComponent(value.trim())}&includeArchived=${includeArchived}`;
        const res = await fetchDocuments(url, 'GET', authKey);
        if (seq === hintSeq.current) {
          setLocationHints((Array.isArray(res) ? res : []).map(h => ({ id: h.id, label: hintLabel(h) })));
        }
      } catch (err) {
        console.error('Failed to fetch locations', err);
      } finally {
        if (seq === hintSeq.current) setHintsLoading(false);
      }
    }, 300);
  };

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const handleHintClick = (hint) => {
    hintSeq.current++;
    setTempFilters(prev => ({ ...prev, location: hint.id, locationLabel: hint.label }));
    setLocationHints([]);
    setHintsLoading(false);
  };

  const openModal = () => {
    setTempFilters(filters);
    setLocationHints([]);
    setHintsLoading(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    hintSeq.current++;
    clearTimeout(hintTimer.current);
    setLocationHints([]);
    setHintsLoading(false);
    setIsModalOpen(false);
  };

  const applyFilters = () => {
    setFilters({ ...tempFilters, location: tempFilters.locationLabel.trim() ? tempFilters.location : "" });
    closeModal();
  };

  const handleReset = () => {
    setTempFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    closeModal();
  };

  // ---- table ---------------------------------------------------------------------------------------------------

  const columns = useMemo(() => [
    {
      id: 'name',
      Header: t('equipments_list_table_heading_name_text'),
      render: (row) => <span className="me-2 text-left">{row.name}</span>,
    },
    { id: 'expander', Header: '', disableSortBy: true },
    {
      id: 'db_address_street',
      Header: t('equipments_list_table_heading_address_text'),
      render: (row) => row.db_address_id === EMPTY_GUID
        ? t('No address, it is mobile')
        : `${row.db_address_street || ''} - ${row.db_address_street_number || ''} ${row.db_address_street2 || ''}`,
    },
    { id: 'equipment_family_name', Header: t('equipments_list_table_heading_type_text') },
    { id: 'customer_reference', Header: t('equipments_list_table_heading_reference_text') },
    { id: 'equipment_brand_name', Header: t('equipments_list_table_heading_brand_text') },
    { id: 'equipment_model_name', Header: t('equipments_list_table_heading_modal_text') },
    { id: 'serial_number', Header: t('equipments_list_table_heading_serial_number_text') },
    { id: 'barcode', Header: t('equipments_list_table_heading_bar_code_text') },
    {
      id: 'project_status_name',
      Header: t('equipments_list_table_heading_status_text'),
      render: (row) => {
        const color = statusColor(row);
        return (
          <span
            className="text-base min-w-max inline-flex items-center pe-3 px-2 pb-1 pt-1 rounded-full"
            style={{ color, backgroundColor: `${color}1f` }}
          >
            <Circle className="inline w-2 h-2 mr-1 rounded-full" style={{ color, backgroundColor: color }} /> {row.project_status_name}
          </span>
        );
      },
    },
  ].map(c => ({ accessor: c.id === 'expander' ? undefined : c.id, ...c })), [t]);

  const {
    getTableProps,
    headerGroups,
    canPreviousPage,
    canNextPage,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize, sortBy },
  } = useTable(
    {
      columns,
      data: roots,
      manualPagination: true,
      manualSortBy: true,
      pageCount,
      autoResetPage: false,
      autoResetSortBy: false,
      disableMultiSort: true,
      initialState: { pageIndex: 0, pageSize: PAGE_SIZES[0] },
    },
    useSortBy,
    usePagination,
  );

  // ---- data: blocks of roots, children, expanded rows ---------------------------------------------------------

  const apiRequest = useMemo(() => toApiRequest(filters, includeArchived), [filters, includeArchived]);
  const filtered = isFiltered(filters);
  const sort = sortBy[0];
  const sortColumn = sort ? SORT_COLUMNS[sort.id] ?? null : null;
  const sortDesc = sort ? !!sort.desc : false;

  // Filters + archived + sort: when it changes the list restarts at the first page
  const queryKey = `${JSON.stringify(apiRequest)}|${sortColumn}|${sortDesc}`;
  const prevQueryKey = useRef(queryKey);
  const requestSeq = useRef(0);
  // queryKey -> { total, blocks: Map<blockIndex, roots[]>, pending: Map<blockIndex, Promise>,
  //               children: Map<id, { items, total }>, expanded: Set<id> }. Kept while the component is mounted.
  const cacheRef = useRef(new Map());

  const getEntry = useCallback((key) => {
    let entry = cacheRef.current.get(key);
    if (!entry) {
      entry = { total: null, blocks: new Map(), pending: new Map(), children: new Map(), expanded: new Set() };
      cacheRef.current.set(key, entry);
    }
    return entry;
  }, []);

  // The expanded rows belong to the query: restore them when the query changes
  useEffect(() => {
    setExpanded(new Set(getEntry(queryKey).expanded));
  }, [queryKey, getEntry]);

  useEffect(() => {
    if (prevQueryKey.current !== queryKey) {
      prevQueryKey.current = queryKey;
      if (pageIndex !== 0) {
        gotoPage(0); // the effect runs again for page 0
        return;
      }
    }

    const entry = getEntry(queryKey);
    const key = queryKey;

    // Filtered: keep the branches returned with the roots as loaded children, and expand them
    // (only when all the children on the branch came back; otherwise the row loads them on expand)
    const keepBranches = (items) => {
      const byId = new Map(items.map(r => [r.id, r]));
      const groups = new Map();
      items.filter(r => r.kind === 'branch').forEach(r => {
        if (!groups.has(r.parent_id)) groups.set(r.parent_id, []);
        groups.get(r.parent_id).push(r);
      });
      groups.forEach((group, parentId) => {
        const parent = byId.get(parentId);
        if (parent && group.length === parent.branch_child_count && !entry.children.has(parentId)) {
          entry.children.set(parentId, { items: group, total: group.length });
          entry.expanded.add(parentId);
        }
      });
    };

    // Loads one block of BLOCK_SIZE roots once; concurrent calls share the same request
    const loadBlock = (blockIndex) => {
      if (entry.blocks.has(blockIndex)) return Promise.resolve();
      if (entry.pending.has(blockIndex)) return entry.pending.get(blockIndex);

      const payload = { ...apiRequest, page: blockIndex, pageSize: BLOCK_SIZE, sortBy: sortColumn, sortDesc };
      const request = fetchDocuments('api/ProjectView/SearchPaged', 'POST', authKey, payload)
        .then(response => {
          const items = response?.items ?? [];
          entry.total = response?.total ?? 0;
          if (filtered) keepBranches(items);
          entry.blocks.set(blockIndex, items.filter(r => r.kind !== 'branch'));
          if (prevQueryKey.current === key) setExpanded(new Set(entry.expanded));
        })
        .finally(() => entry.pending.delete(blockIndex));
      entry.pending.set(blockIndex, request);
      return request;
    };

    const firstRow = pageIndex * pageSize;
    const blockIndex = Math.floor(firstRow / BLOCK_SIZE); // a page never spans two blocks (BLOCK_SIZE % pageSize === 0)
    const offset = firstRow % BLOCK_SIZE;

    const show = () => {
      const rows = entry.blocks.get(blockIndex) ?? [];
      setRoots(rows.slice(offset, offset + pageSize));
      setTotal(entry.total);
      setPageCount(Math.max(1, Math.ceil(entry.total / pageSize)));
      setError(null);
      setIsLoading(false);

      // On the last page of a block, load the next block in the background
      const nextBlockStart = (blockIndex + 1) * BLOCK_SIZE;
      if (offset + pageSize >= BLOCK_SIZE && nextBlockStart < entry.total) {
        loadBlock(blockIndex + 1).catch(() => { }); // retried when the page is opened
      }
    };

    const seq = ++requestSeq.current;
    if (entry.blocks.has(blockIndex)) {
      show();
      return;
    }

    setIsLoading(true);
    loadBlock(blockIndex)
      .then(() => {
        if (seq === requestSeq.current) show(); // ignore if the user moved on meanwhile
      })
      .catch(err => {
        if (seq === requestSeq.current) {
          setError(err);
          setIsLoading(false);
        }
      });
  }, [queryKey, pageIndex, pageSize, apiRequest, sortColumn, sortDesc, filtered, gotoPage, authKey, getEntry]);

  // Loads (more) children of a row: on a filtered list, the children on a branch to a match (all when none is)
  const loadChildren = useCallback(async (id) => {
    const key = queryKey;
    const entry = getEntry(key);
    const loaded = entry.children.get(id);
    const page = loaded ? Math.ceil(loaded.items.length / CHILD_PAGE_SIZE) : 0;

    setLoadingChildren(prev => new Set(prev).add(id));
    try {
      const payload = { ...apiRequest, parent_id: id, page, pageSize: CHILD_PAGE_SIZE, sortBy: sortColumn, sortDesc };
      const response = await fetchDocuments('api/ProjectView/SearchPaged', 'POST', authKey, payload);
      const items = response?.items ?? [];
      entry.children.set(id, { items: [...(loaded?.items ?? []), ...items], total: response?.total ?? items.length });
      setCacheVersion(v => v + 1);
    } catch (err) {
      console.error('Failed to load the children', err);
      if (prevQueryKey.current === key) {
        entry.expanded.delete(id);
        setExpanded(new Set(entry.expanded));
      }
    } finally {
      setLoadingChildren(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [queryKey, apiRequest, sortColumn, sortDesc, authKey, getEntry]);

  const toggleExpand = useCallback((id) => {
    const entry = getEntry(queryKey);
    if (entry.expanded.has(id)) {
      entry.expanded.delete(id);
    } else {
      entry.expanded.add(id);
      if (!entry.children.has(id)) loadChildren(id);
    }
    setExpanded(new Set(entry.expanded));
  }, [queryKey, getEntry, loadChildren]);

  // ---- rendering -----------------------------------------------------------------------------------------------

  const currentEntry = cacheRef.current.get(queryKey);

  const renderRows = (rows, depth) => rows.map(row => {
    const canExpand = row.has_child || row.branch_child_count > 0;
    const isOpen = canExpand && expanded.has(row.id);
    const children = isOpen ? currentEntry?.children.get(row.id) : null;
    const isContext = filtered && !row.is_match; // only leads to a match

    return (
      <React.Fragment key={row.id}>
        <tr
          className={`cursor-pointer hover:bg-primary/50 hover:text-primary-foreground transition-colors duration-200 ease-in-out ${isContext ? 'text-slate-400' : ''}`}
          title={isContext ? t('equipments_list_branch_context') : undefined}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((column, index) => (
            <td
              key={column.id}
              className={`px-2 py-4 whitespace-nowrap text-base font-normal ${index === 0 ? 'flex' : ''}`}
              style={index === 0 ? { paddingLeft: `${depth * 2 + 1}em` } : {}}
              onClick={column.id === 'expander' ? (e) => e.stopPropagation() : undefined}
            >
              {index === 0 && depth > 0 && <CornerDownRight className="mr-1" size={20} />}
              {column.id === 'expander'
                ? (canExpand && (
                  <button onClick={() => toggleExpand(row.id)} className="pr-1" aria-expanded={isOpen}>
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                ))
                : (column.render ? column.render(row) : row[column.id])}
            </td>
          ))}
        </tr>
        {children && renderRows(children.items, depth + 1)}
        {isOpen && loadingChildren.has(row.id) && (
          <TableSkeletonRows rows={2} columns={columns.length} wideColumns={[0, 2]} />
        )}
        {children && children.total > children.items.length && !loadingChildren.has(row.id) && (
          <tr>
            <td colSpan={columns.length} className="py-2 text-base" style={{ paddingLeft: `${(depth + 1) * 2 + 1}em` }}>
              <button onClick={() => loadChildren(row.id)} className="text-primary font-medium hover:underline">
                {t('equipments_list_show_more', { count: children.total - children.items.length })}
              </button>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  });

  if (error) {
    return <div className="text-center mt-10 text-red-600">Error fetching data: {error.message}</div>;
  }

  return (
    <>
      <div className="flex items-center mb-6">
        <input
          id="include_archived"
          type="checkbox"
          checked={includeArchived}
          onChange={() => setIncludeArchived(!includeArchived)}
          className="mr-2 w-4 h-4 cursor-pointer border border-primary rounded-md accent-primary"
        />
        <label htmlFor="include_archived" className="text-zinc-800 text-base font-medium cursor-pointer">{t('equipments_list_page_checkbox_label')}</label>
      </div>

      <button onClick={openModal} className="flex justify-center items-center bg-primary-foreground text-primary text-base font-medium leading-normal border border-2 border-primary w-40 px-5 py-2 rounded-md mb-4 hover:bg-primary hover:text-primary-foreground">
        {t('equipments_list_page_filter_button')} <Filter size={24} className="ml-4" />
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative w-100 p-4 bg-white rounded-lg shadow-md border space-y-4">
            <X onClick={closeModal} className="absolute -top-1 -right-1 bg-primary-foreground text-primary border border-2 border-primary px-2 rounded-full h-9 w-9 flex items-center justify-center hover:bg-primary hover:text-primary-foreground" />
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex justify-center items-center bg-primary-foreground text-primary text-base font-medium leading-normal border border-2 border-primary w-48 px-4 py-2 rounded-md mb-2 hover:bg-primary hover:text-primary-foreground">
                {t('equipments_list_page_filter_label')}
                <Filter size={24} className="ml-4" />
              </div>
            </div>

            {/* Location */}
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 w-4 h-5 text-zinc-800" />
              <input
                name="location"
                id="location"
                type="text"
                autoComplete="off"
                value={tempFilters.locationLabel}
                onChange={handleLocationChange}
                placeholder={t("equipments_list_page_filter_location")}
                className="w-full pl-10 pr-10 py-2 border rounded-md text-gray-500 text-base font-normal focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {hintsLoading && (
                <Loader2 className="absolute right-3 top-2.5 w-5 h-5 text-primary animate-spin" aria-label="Loading" />
              )}
              {locationHints.length > 0 && (
                <ul className="absolute z-10 bg-white border mt-1 rounded-md w-full shadow-md max-h-64 overflow-y-auto">
                  {locationHints.map(hint => (
                    <li
                      key={hint.id}
                      onClick={() => handleHintClick(hint)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-base text-gray-700"
                    >
                      {hint.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Keyword */}
            <div className="relative">
              <Text className="absolute left-3 top-2.5 w-4 h-5 text-zinc-800" />
              <input
                name='keyword'
                id='keyword'
                type="text"
                value={tempFilters.keyword}
                onChange={(e) => setTempFilters(prev => ({ ...prev, keyword: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                placeholder={t("equipments_list_page_filter_keyword")}
                className="w-full pl-10 pr-3 py-2 border rounded-md text-gray-500 text-base font-normal focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Brands */}
            <div className="relative">
              <Bold className="absolute left-3 top-2.5 w-4 h-5 text-zinc-800" />
              <Select
                components={animatedComponents}
                options={brandOptions}
                isClearable
                value={brandOptions.find(option => option.value === tempFilters.brand) || null}
                onChange={(selected) => setTempFilters(prev => ({
                  ...prev,
                  brand: selected?.value ?? EMPTY_GUID,
                  // a model of another brand no longer applies
                  model: selected && Array.isArray(fetchModels) && !fetchModels.some(m => m.id === prev.model && m.equipment_brand_id === selected.value) ? EMPTY_GUID : prev.model,
                }))}
                placeholder={t("equipments_list_page_filter_brands")}
                className="w-full pl-10 border rounded-md text-gray-500 text-base font-normal"
                classNamePrefix="react-select"
                styles={selectStyles}
              />
            </div>

            {/* Models */}
            <div className="relative">
              <Hash className="absolute left-3 top-2.5 w-4 h-5 text-zinc-800" />
              <Select
                components={animatedComponents}
                options={modelOptions}
                isClearable
                value={modelOptions.find(option => option.value === tempFilters.model) || null}
                onChange={(selected) => setTempFilters(prev => ({ ...prev, model: selected?.value ?? EMPTY_GUID }))}
                placeholder={t("equipments_list_page_filter_models")}
                className="w-full pl-10 border rounded-md text-gray-500 text-base font-normal"
                classNamePrefix="react-select"
                styles={selectStyles}
              />
            </div>

            {/* Status */}
            <div className="relative">
              <BarChart className="absolute left-3 top-2.5 w-4 h-5 text-zinc-800" />
              <Select
                components={animatedComponents}
                options={statusOptions}
                isClearable
                value={statusOptions.find(option => option.value === tempFilters.status) || null}
                onChange={(selected) => setTempFilters(prev => ({ ...prev, status: selected?.value ?? EMPTY_GUID }))}
                placeholder={t("equipments_list_page_filter_status")}
                className="w-full pl-10 border rounded-md text-gray-500 text-base font-normal"
                classNamePrefix="react-select"
                styles={selectStyles}
              />
            </div>

            {/* Footer buttons */}
            <div className="grid grid-cols-2 gap-4 justify-between pt-2">
              <button onClick={handleReset} className="px-5 py-2 border border-2 border-primary rounded-md text-base bg-primary-foreground text-primary hover:bg-primary hover:text-primary-foreground">
                {t('equipments_list_page_filter_reset')}
              </button>
              <button onClick={applyFilters} className="px-5 py-2 border border-2 border-primary bg-primary text-primary-foreground rounded-md text-base hover:bg-primary-foreground hover:text-primary">
                {t('equipments_list_page_filter_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='bg-white shadow-md rounded-lg'>
        {title && <h2 className="text-xl font-semibold mb-2 px-4 pt-4">{title}</h2>}
        <div className="bg-blue-100 flex items-center justify-between text-blue-500 text-base font-normal px-4 py-1 mb-2 rounded-lg">
          <span className="flex items-center">
            <BadgeInfo className='mr-2 w-5 h-5 text-blue-500' /> {helpText}
          </span>
          {filtered && (
            <button onClick={handleReset} className="flex items-center text-sm font-medium text-primary hover:underline">
              <X className="w-4 h-4 mr-1" /> {tCommon("filter_clear_all")}
            </button>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <table {...getTableProps()} className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="bg-white">
              {headerGroups.map((headerGroup, headerIndex) => {
                const { key: headerGroupKey, ...restHeaderGroupProps } = headerGroup.getHeaderGroupProps();
                return (
                  <tr key={headerGroupKey || headerIndex} {...restHeaderGroupProps} className="bg-white">
                    {headerGroup.headers.map((column, index) => {
                      const sortProps = column.canSort ? column.getSortByToggleProps() : {};
                      const { key, ...restHeaderProps } = column.getHeaderProps(sortProps);
                      return (
                        <th
                          key={key || column.id}
                          {...restHeaderProps}
                          className={`px-2 py-3 text-left whitespace-nowrap text-slate-500 text-base font-medium leading-none ${index !== 0 ? 'border-r border-gray-300' : ''} ${column.canSort ? 'cursor-pointer select-none' : ''}`}
                          aria-sort={column.isSorted ? (column.isSortedDesc ? 'descending' : 'ascending') : 'none'}
                        >
                          <div className="flex items-center">
                            {column.render('Header')}
                            {column.isSorted ? (
                              column.isSortedDesc
                                ? <ArrowDown className="inline w-4 h-4 ml-1" />
                                : <ArrowUp className="inline w-4 h-4 ml-1" />
                            ) : null}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                );
              })}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!isLoading && renderRows(roots, 0)}
              {/* Skeleton inside the table: lines up with the columns and keeps the previous page's row count */}
              {isLoading && (
                <TableSkeletonRows rows={roots.length} columns={columns.length} wideColumns={[0, 2]} />
              )}
              {!isLoading && roots.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-2 py-6 text-center text-base text-slate-500">
                    {t("equipments_list_no_results")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between p-4">
            <span className="text-base text-slate-700">
              {t("equipments_list_table_pagination_page")} {pageIndex + 1} {t("equipments_list_table_pagination_of")} {pageCount}
            </span>
            <div>
              <button onClick={() => gotoPage(0)} disabled={!canPreviousPage || isLoading} className="py-0.5 px-1 md:px-2 mr-1 text-primary rounded-md border border-primary disabled:opacity-50">
                <ArrowLeftToLine className="w-4" />
              </button>
              <button onClick={() => previousPage()} disabled={!canPreviousPage || isLoading} className="py-0.5 px-1 md:px-2 mr-1 text-primary rounded-md border border-primary disabled:opacity-50">
                <ArrowLeft className="w-4" />
              </button>
              <button onClick={() => nextPage()} disabled={!canNextPage || isLoading} className="py-0.5 px-1 md:px-2 mr-1 text-primary rounded-md border border-primary disabled:opacity-50">
                <ArrowRight className="w-4" />
              </button>
              <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage || isLoading} className="py-0.5 px-1 md:px-2 mr-1 text-primary rounded-md border border-primary disabled:opacity-50">
                <ArrowRightToLine className="w-4" />
              </button>
            </div>
            <select name="table_pagination" id="table_pagination" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="ml-1 p-1 md:p-1 text-base text-slate-700 border border-slate-700 rounded-md max-w-32">
              {PAGE_SIZES.map(size => (
                <option key={size} value={size}>
                  {t("equipments_list_table_pagination_show")} {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  );
};

export default EquipmentTreeTable;
