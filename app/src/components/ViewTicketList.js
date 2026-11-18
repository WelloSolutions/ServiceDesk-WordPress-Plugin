import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { APP_BASENAME } from '../config';
import { useTable, useSortBy, usePagination } from 'react-table';
import { fetchDocuments } from '../services/apiServiceDocuments.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { BadgeInfo, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowLeftToLine, ArrowRightToLine, Circle, X } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { setPrimaryTheme } from "../utils/setTheme";
import { TableSkeletonRows } from '../utils/setTableSkleton.js';
import ColumnFilter, { isFilterActive } from './ColumnFilter';

// SD-510: sorting and filtering are done by the API (TaskView/SearchPaged). Rows are loaded in blocks of
// BLOCK_SIZE and cached per tab + sort + filters until the user leaves the screen; pages are cut from the cached blocks.
const PAGE_SIZES = [12, 24, 36, 48];
const BLOCK_SIZE = 144; // divisible by every page size, so a page always fits in one block

// Table column id -> filter column of TaskView/SearchPaged
const FILTER_COLUMNS = {
  id2: 'reference',
  date_create: 'date_create',
  subject: 'name',
  assigned_to_user_fullname: 'assigned',
  task_type_name: 'task_type',
  task_status_name: 'task_status',
};

const toApiFilters = (filters) =>
  Object.entries(filters)
    .filter(([columnId, filter]) => FILTER_COLUMNS[columnId] && isFilterActive(filter))
    .map(([columnId, filter]) => ({
      column: FILTER_COLUMNS[columnId],
      op: filter.op,
      value: filter.value ?? null,
      value2: filter.value2 ?? null,
      values: filter.values ?? null,
    }));

const translateById = (list, id, lang, fallback) => {
  const item = Array.isArray(list) ? list.find(x => x.id === id) : undefined;
  return item?.translations?.find(tr => tr.language_code === lang)?.value ?? item?.name ?? fallback;
};

const ViewTicketList = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  setPrimaryTheme(auth?.colorPrimary);
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [ticketsStatus, setTicketsStatus] = useState([]);
  const [ticketsType, setTicketsType] = useState([]);
  const [translationsLoaded, setTranslationsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('open');
  const { t, i18n } = useTranslation('ticketList');
  const { t: tCommon } = useTranslation('common');
  const lang = i18n.language.split("-")[0].toUpperCase();
  // Column filters: table column id -> { op, value, value2, values }
  const [filters, setFilters] = useState({});
  const setColumnFilter = useCallback((columnId, filter) => {
    setFilters(prev => {
      const next = { ...prev };
      if (filter) next[columnId] = filter; else delete next[columnId];
      return next;
    });
  }, []);
  const hasFilters = Object.values(filters).some(isFilterActive);

  useEffect(() => {
    if (translationsLoaded) return;

    const fetchStatusTranslations = async () => {
      const response = await fetchDocuments('api/TaskStatus/Translations', 'GET', auth.authKey);
      setTicketsStatus(Array.isArray(response) ? response : []);
    };
    const fetchTypeTranslations = async () => {
      const response = await fetchDocuments('api/TaskType/Translations', 'GET', auth.authKey);
      setTicketsType(Array.isArray(response) ? response : []);
    };
    fetchStatusTranslations();
    fetchTypeTranslations();
    setTranslationsLoaded(true);
  }, [auth, translationsLoaded]);

  const statusTicket = useMemo(() => ({
    "bb68d95e-1706-486b-b282-2ba7bede3ea6": {
      "name": "Credit Blocked",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "b6eccbf1-26c3-4f95-9b20-f2ebabd6bd00": {
      "name": "Credit Released",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "4c1a28dc-e213-429d-bbd0-2595814ca9fc": {
      "name": "In progress",
      "statusColors": "bg-yellow-100 text-yellow-600",
      "statusDotColors": "bg-yellow-600 text-yellow-600",
    },
    "0d738f35-d5e2-4065-8639-a41202531c96": {
      "name": "Pre-diagnose",
      "statusColors": "bg-blue-100 text-blue-600",
      "statusDotColors": "bg-blue-600 text-blue-600",
    },
    "8b9d1c19-bb96-4e1c-8b32-4b433d0d1a62": {
      "name": "Quote/Order",
      "statusColors": "bg-green-100 text-green-600",
      "statusDotColors": "bg-green-600 text-green-600",
    },
    "d106c501-9b89-4a2a-886b-f0bee640045a": {
      "name": "Waiting for Parts",
      "statusColors": "bg-indigo-100 text-indigo-600",
      "statusDotColors": "bg-indigo-600 text-indigo-600",
    },
    "df41bd97-ea7e-412f-bdfe-8f97f783e08d": {
      "name": "Waiting for Customer",
      "statusColors": "bg-indigo-100 text-indigo-600",
      "statusDotColors": "bg-indigo-600 text-indigo-600",
    },
    "6bfec05d-f2c3-47c5-bea1-5d264503f337": {
      "name": "Canceled",
      "statusColors": "bg-red-100 text-red-600",
      "statusDotColors": "bg-red-600 text-red-600",
    },
    "461748f9-1c99-47b9-9456-880054ec4ce2": {
      "name": "Completed",
      "statusColors": "bg-pink-100 text-pink-600",
      "statusDotColors": "bg-pink-600 text-pink-600",
    },
    "9a33634d-eb69-42fc-aaee-96f3296f4f40": {
      "name": "Escalated to WO",
      "statusColors": "bg-orange-100 text-orange-600",
      "statusDotColors": "bg-orange-600 text-orange-600",
    },
    "e06515b5-b8c0-4529-befa-84dc7f23c25a": {
      "name": "Verzending transport",
      "statusColors": "bg-green-100 text-green-600",
      "statusDotColors": "bg-green-600 text-green-600",
    },
  }), []);

  // Options of the type / status filters: id + name in the current language (same as the cells)
  const toFilterOptions = useCallback((list) =>
    (Array.isArray(list) ? list : [])
      .map(item => ({ value: String(item.id), label: translateById(list, item.id, lang, item.name ?? '') }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  [lang]);

  // Column ids are the sort keys accepted by the API
  const columns = useMemo(
    () => [
      {
        Header: t('tickets_list_table_heading_reference_text'),
        accessor: 'id2',
        filterType: 'text',
        Cell: ({ row }) => (
          <div className="text-center">
            <span className="font-medium">
              {row.original.id2}
            </span></div>
        ),
      },
      {
        Header: t('tickets_list_table_heading_created_date_text'), accessor: 'date_create',
        filterType: 'date',
        Cell: ({ value }) => new Date(value).toLocaleDateString("en-GB")
      },
      {
        Header: t('tickets_list_table_heading_name_text'), accessor: 'subject',
        filterType: 'text',
        Cell: ({ value }) => {
          const text = value ?? '';
          return <span>{text.length > 50 ? text.slice(0, 50) + '...' : text}</span>;
        },
      },
      {
        Header: t('tickets_list_table_heading_assigned_name_text'), accessor: 'assigned_to_user_fullname',
        filterType: 'text',
        Cell: ({ row }) => (
          row.original.assigned_to_user_fullname?.trim() ? row.original.assigned_to_user_fullname : t('tickets_list_not_assigned_label')
        ),
      },
      {
        Header: t('tickets_list_table_heading_type_text'), accessor: 'task_type_name',
        filterType: 'options',
        filterOptions: toFilterOptions(ticketsType),
        Cell: ({ row }) => (
          <span className={`text-base font-medium`}>
            {translateById(ticketsType, row.original.task_type_id, lang, row.original.task_type_name)}
          </span>
        ),
      },
      {
        Header: t('tickets_list_table_heading_status_text'), accessor: 'task_status_name',
        filterType: 'options',
        filterOptions: toFilterOptions(ticketsStatus),
        Cell: ({ row }) => (
          <span className={`text-base min-w-max inline-flex items-center font-medium pe-3 px-2 pb-1 pt-1 rounded-full ${statusTicket[row.original.task_status_id]?.statusColors || "bg-gray-200 text-gray-800"}`}>
            <Circle className={`inline w-2 h-2 mr-1 rounded-full ${statusTicket[row.original.task_status_id]?.statusDotColors || "bg-gray-800 text-gray-800"}`} />
            {translateById(ticketsStatus, row.original.task_status_id, lang, row.original.task_status_name)}
          </span>
        ),
      },
    ],
    [ticketsType, ticketsStatus, statusTicket, t, lang, toFilterOptions]
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
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
      data: tickets,
      manualPagination: true,
      manualSortBy: true,
      pageCount,
      autoResetPage: false,
      autoResetSortBy: false,
      disableMultiSort: true,
      initialState: { pageIndex: 0, pageSize: PAGE_SIZES[0] },
    },
    useSortBy,
    usePagination
  );

  // Tab + sort + filters: when it changes the list restarts at the first page
  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);
  const queryKey = `${isArchived}|${JSON.stringify(sortBy)}|${JSON.stringify(apiFilters)}`;
  const prevQueryKey = useRef(queryKey);
  const requestSeq = useRef(0);
  // queryKey -> { total, blocks: Map<blockIndex, rows[]>, pending: Map<blockIndex, Promise> }.
  // Kept until the user leaves the screen; a page refresh loads fresh data.
  const cacheRef = useRef(new Map());
  const authKey = auth?.authKey;

  useEffect(() => {
    if (prevQueryKey.current !== queryKey) {
      prevQueryKey.current = queryKey;
      if (pageIndex !== 0) {
        gotoPage(0); // the effect runs again for page 0
        return;
      }
    }

    const sort = sortBy[0];
    let entry = cacheRef.current.get(queryKey);
    if (!entry) {
      entry = { total: null, blocks: new Map(), pending: new Map() };
      cacheRef.current.set(queryKey, entry);
    }

    // Loads one block of BLOCK_SIZE rows once; concurrent calls share the same request
    const loadBlock = (blockIndex) => {
      if (entry.blocks.has(blockIndex)) return Promise.resolve();
      if (entry.pending.has(blockIndex)) return entry.pending.get(blockIndex);

      const payload = {
        archived: isArchived,
        page: blockIndex,
        pageSize: BLOCK_SIZE,
        sortBy: sort ? sort.id : null,
        sortDesc: sort ? !!sort.desc : false,
        filters: apiFilters,
      };
      const request = fetchDocuments('api/TaskView/SearchPaged', 'POST', authKey, payload)
        .then(response => {
          entry.total = response?.total ?? 0;
          entry.blocks.set(blockIndex, response?.items ?? []);
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
      setTickets(rows.slice(offset, offset + pageSize));
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
  }, [queryKey, pageIndex, pageSize, isArchived, sortBy, apiFilters, gotoPage, authKey]);

  return (
    <div className="w-full mx-auto p-1 md:p-4">
      <h1 className="text-zinc-900 text-3xl font-semibold mb-6">{t("tickets_list_page_title")}</h1>

      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center mb-6 font-semibold text-zinc-900 text-base"
      >
        <ArrowLeft className="mr-2 w-5 h-5" /> {t("tickets_list_page_go_back")}
      </button>

      <div className='shadow-md rounded-lg'>
        <div className="flex text-lg mb-4">
          <button
            className={`px-4 py-2 mr-2 font-semibold leading-7 ${selectedTab === 'open' ? 'text-gray-900 border-b-2 border-zinc-800' : 'text-slate-500'}`}
            onClick={() => { setSelectedTab('open'); setIsArchived(false); }}
          >
            {t("tickets_list_toggle_open_tickets_text")}
          </button>
          <button
            className={`px-4 py-2 font-semibold leading-7 ${selectedTab === 'completed' ? 'text-gray-900 border-b-2 border-zinc-800' : 'text-slate-500'}`}
            onClick={() => { setSelectedTab('completed'); setIsArchived(true); }}
          >
            {t("tickets_list_toggle_completed_tickets_text")}
          </button>
        </div>

        <div className="bg-blue-100 flex items-center justify-between text-blue-500 text-base font-normal px-4 py-1 mb-2 rounded-lg">
          <span className="flex items-center">
            <BadgeInfo className='mr-2 w-5 h-5 text-blue-500' /> {t("tickets_list_page_helping_text")}
          </span>
          {hasFilters && (
            <button onClick={() => setFilters({})} className="flex items-center text-sm font-medium text-primary hover:underline">
              <X className="w-4 h-4 mr-1" /> {tCommon("filter_clear_all")}
            </button>
          )}
        </div>

        {error && (
          <div className="text-center my-4 text-red-600">Error fetching tickets: {error.message}</div>
        )}

        <div className="overflow-x-auto">
          <table {...getTableProps()} className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="bg-white">
              {headerGroups.map((headerGroup, hgIdx) => {
                const headerGroupProps = headerGroup.getHeaderGroupProps();
                const { key: headerGroupKey, ...restHeaderGroupProps } = headerGroupProps;
                return (
                  <tr key={headerGroupKey || hgIdx} {...restHeaderGroupProps} className="bg-white divide-x divide-gray-300">
                    {headerGroup.headers.map((column, colIdx) => {
                      const headerProps = column.getHeaderProps(column.getSortByToggleProps());
                      const { key: headerKey, ...restHeaderProps } = headerProps;
                      return (
                        <th key={headerKey || colIdx} {...restHeaderProps}
                          className="p-2 whitespace-nowrap text-slate-500 text-base font-medium leading-none">
                          {column.render('Header')}
                          {column.filterType && (
                            <ColumnFilter
                              type={column.filterType}
                              ops={column.filterOps}
                              options={column.filterOptions}
                              value={filters[column.id]}
                              onChange={(filter) => setColumnFilter(column.id, filter)}
                            />
                          )}
                          {column.isSorted ? (
                            column.isSortedDesc ? (
                              <ArrowDown className="inline w-4 h-4 ml-1" />
                            ) : (
                              <ArrowUp className="inline w-4 h-4 ml-1" />
                            )
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                );
              })}
            </thead>
            <tbody {...getTableBodyProps()} className="bg-white divide-y divide-gray-200">
              {!isLoading &&
                page.map((row, rowIdx) => {
                  prepareRow(row);
                  const rowProps = row.getRowProps();
                  const { key: rowKey, ...restRowProps } = rowProps;
                  return (
                    <tr key={rowKey || row.original.id || rowIdx} {...restRowProps}
                      className="cursor-pointer hover:bg-primary/50 hover:text-primary-foreground transition-colors duration-200 ease-in-out"
                      onClick={() => window.open(`${window.location.origin}${APP_BASENAME}/ticket/${row.original.id}`, "_blank")}>
                      {row.cells.map((cell, cellIdx) => {
                        const cellProps = cell.getCellProps();
                        const { key: cellKey, ...restCellProps } = cellProps;
                        return (
                          <td key={cellKey || cellIdx} {...restCellProps} className="self-stretch px-1 py-2 text-base font-normal">
                            {cell.render('Cell')}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              {/* Skeleton inside the table: lines up with the columns and keeps the previous page's row count */}
              {isLoading && (
                <TableSkeletonRows rows={page.length} columns={columns.length} wideColumns={[2]} />
              )}
              {!isLoading && !error && tickets.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-2 py-6 text-center text-base text-slate-500">
                    {t("tickets_list_no_results")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between p-4">
            <span className="text-base text-slate-700">
              {t("ticket_list_table_pagination_page")} {pageIndex + 1} {t("ticket_list_table_pagination_of")} {pageCount}
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
                  {t("ticket_list_table_pagination_show")} {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewTicketList;
