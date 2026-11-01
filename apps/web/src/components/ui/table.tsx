import * as React from "react";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table data-slot="table" className={cn("w-full min-w-[560px] border-collapse text-sm", className)} {...props} />
    </div>
  );
}
function TableHeader(props: React.ComponentProps<"thead">) { return <thead data-slot="table-header" {...props} />; }
function TableBody(props: React.ComponentProps<"tbody">) { return <tbody data-slot="table-body" {...props} />; }
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("group [&:not(:first-child)>td]:border-t [&>td]:border-border", className)} {...props} />;
}
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn("px-2 pb-3 text-left text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary", className)}
      {...props}
    />
  );
}
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-2 py-3 align-middle first:rounded-l-xl last:rounded-r-xl group-hover:bg-card-hover", className)}
      {...props}
    />
  );
}
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
