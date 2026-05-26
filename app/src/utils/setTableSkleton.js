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
                  <div className="h-3 w-40 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }