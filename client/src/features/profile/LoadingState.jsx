import { Card, LoadingBlock, Skeleton } from "../../components/ui";

/** Profile page placeholder: header skeleton + spinner. */
const LoadingState = ({ label = "Loading profile" }) => (
  <div className="space-y-6" aria-busy="true">
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-2.5 sm:px-6">
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-32 border-b border-border sm:h-44" />
      <div className="px-5 pb-6 sm:px-6">
        <Skeleton className="-mt-12 size-24 border border-border-strong" />
        <div className="mt-5 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-3 w-full max-w-md" />
        </div>
      </div>
      <div className="grid grid-cols-3 border-t border-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 border-r border-border px-4 py-3.5 last:border-r-0 sm:px-6">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    </Card>
    <LoadingBlock label={label} />
  </div>
);

export default LoadingState;
