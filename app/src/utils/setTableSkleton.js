// Number of skeleton rows when there is no previous page to match (first load)
export const SKELETON_FIRST_LOAD_ROWS = 5;

/**
 * Skeleton rows rendered inside a real <tbody>, so the bars line up with the table's own columns.
 * - rows: pass the row count of the page being replaced (keeps the table height, no jump);
 *   falls back to SKELETON_FIRST_LOAD_ROWS when 0 (first load).
 * - columns: number of columns.
 * - wideColumns: column indexes that get longer, slightly varying bars (e.g. names / descriptions).
 * - checkboxColumn: column index that shows a small square instead of a bar.
 */
export const TableSkeletonRows = ({ rows, columns, wideColumns = [], checkboxColumn = -1 }) =>
  Array.from({ length: rows || SKELETON_FIRST_LOAD_ROWS }).map((_, rowIdx) => (
    <tr key={`skeleton-${rowIdx}`} aria-hidden="true">
      {Array.from({ length: columns }).map((__, colIdx) => (
        <td key={colIdx} className="px-2 py-3">
          {colIdx === checkboxColumn ? (
            <div className="w-4 h-4 mx-auto bg-gray-200 rounded-sm animate-pulse" />
          ) : (
            <div
              className="h-4 bg-gray-200 rounded animate-pulse"
              style={{ width: wideColumns.includes(colIdx) ? `${60 + ((rowIdx * 7 + colIdx * 13) % 35)}%` : '70%' }}
            />
          )}
        </td>
      ))}
    </tr>
  ));

export const TableLoadingSkeleton = ({ rows = 5, columns = 6 }) => {
    return (
      <div className="overflow-x-auto animate-pulse">
        <div className="w-full table-auto border-collapse">
          <div className="grid grid-cols-6 bg-gray-100">
            {Array.from({ length: columns }).map((_, index) => (
              <div key={`head-${index}`} className="px-4 py-3">
                <div className="h-3 w-20 rounded bg-gray-300" />
              </div>
            ))}
          </div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={`row-${rowIndex}`} className="grid grid-cols-6 border-t">
              {Array.from({ length: columns }).map((__, colIndex) => (
                <div key={`cell-${rowIndex}-${colIndex}`} className="px-4 py-3">
                  <div className="h-3 w-30 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }