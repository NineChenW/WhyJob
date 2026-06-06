"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Upload, GripVertical, X, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { batchImportCompanies } from "@/actions/companies";
import {
  batchImportCompaniesSchema,
  type BatchImportCompaniesInput,
  type CompanyColumn,
  type ColumnMapping,
} from "@/schemas/company";

// Available columns for import
const AVAILABLE_COLUMNS: {
  value: CompanyColumn;
  label: string;
  description: string;
  required: boolean;
}[] = [
  {
    value: "name",
    label: "Company Name",
    description: "The official name of the company",
    required: true,
  },
  {
    value: "description",
    label: "Description",
    description: "Brief description or notes about the company",
    required: false,
  },
  {
    value: "website",
    label: "Website",
    description: "Company website URL",
    required: false,
  },
  {
    value: "industry",
    label: "Industry",
    description: "Industry sector (e.g., Tech, Finance, Healthcare)",
    required: false,
  },
  {
    value: "size",
    label: "Company Size",
    description: "Number of employees (e.g., 1-10, 11-50, 51-200)",
    required: false,
  },
  {
    value: "stage",
    label: "Stage",
    description: "Funding stage (e.g., Startup, Series A, Public)",
    required: false,
  },
  {
    value: "headquarters",
    label: "Headquarters",
    description: "Company headquarters location",
    required: false,
  },
];

// Sortable item component for reordering columns
function SortableColumnItem({
  mapping,
  onRemove,
  onExcelColumnChange,
}: {
  mapping: ColumnMapping;
  onRemove: (column: CompanyColumn) => void;
  onExcelColumnChange: (column: CompanyColumn, excelColumn: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mapping.column,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const columnInfo = AVAILABLE_COLUMNS.find((c) => c.value === mapping.column);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{columnInfo?.label}</span>
          {columnInfo?.required && <Badge variant="secondary">Required</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{columnInfo?.description}</p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="text"
          placeholder="A"
          value={mapping.excelColumn}
          onChange={(e) => onExcelColumnChange(mapping.column, e.target.value.toUpperCase())}
          className="w-16 text-center font-mono text-sm"
          maxLength={3}
        />
        {!columnInfo?.required && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(mapping.column)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function BatchImportCompaniesDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewData, setPreviewData] = useState<{ rows: any[]; headers: string[] } | null>(null);
  const [currentStep, setCurrentStep] = useState(1); // 1: Select columns, 2: Order & map, 3: Upload & import
  const router = useRouter();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const form = useForm<BatchImportCompaniesInput>({
    resolver: zodResolver(batchImportCompaniesSchema),
    defaultValues: {
      columnMappings: [{ column: "name", excelColumn: "A" }], // Name is required by default
      startRow: 1,
      endRow: undefined,
    },
  });

  // Handle drag end for column reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const items = form.getValues("columnMappings");
        const oldIndex = items.findIndex((item) => item.column === active.id);
        const newIndex = items.findIndex((item) => item.column === over.id);

        form.setValue("columnMappings", arrayMove(items, oldIndex, newIndex));
      }
    },
    [form]
  );

  // Handle column selection
  const handleColumnToggle = (column: CompanyColumn, checked: boolean) => {
    const currentMappings = form.getValues("columnMappings");

    if (checked) {
      // Add column to mappings with default excel column
      const nextLetter = String.fromCharCode(65 + currentMappings.length); // A, B, C, etc.
      form.setValue("columnMappings", [
        ...currentMappings,
        { column, excelColumn: nextLetter },
      ]);
    } else {
      // Remove column from mappings (only if not required)
      const columnInfo = AVAILABLE_COLUMNS.find((c) => c.value === column);
      if (!columnInfo?.required) {
        form.setValue(
          "columnMappings",
          currentMappings.filter((m) => m.column !== column)
        );
      }
    }
  };

  // Handle excel column change
  const handleExcelColumnChange = (column: CompanyColumn, excelColumn: string) => {
    const currentMappings = form.getValues("columnMappings");
    form.setValue(
      "columnMappings",
      currentMappings.map((m) => (m.column === column ? { ...m, excelColumn } : m))
    );
  };

  // Handle remove column
  const handleRemoveColumn = (column: CompanyColumn) => {
    const columnInfo = AVAILABLE_COLUMNS.find((c) => c.value === column);
    if (!columnInfo?.required) {
      const currentMappings = form.getValues("columnMappings");
      form.setValue(
        "columnMappings",
        currentMappings.filter((m) => m.column !== column)
      );
    }
  };

  // Handle file drop
  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith(".xlsx") || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
          form.setValue("file", file);
          form.clearErrors("file");
          // Preview will be loaded on submit
        } else {
          form.setError("file", {
            type: "manual",
            message: "Only .xlsx files are supported",
          });
          toast.error("Only .xlsx files are supported");
        }
      }
    },
    [form]
  );

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      form.setValue("file", files[0]);
      form.clearErrors("file");
    }
  };

  // Handle form submission
  async function onSubmit(data: BatchImportCompaniesInput) {
    setIsSubmitting(true);
    try {
      const result = await batchImportCompanies(data);
      if (result.success) {
        if (result.preview) {
          setPreviewData(result.preview);
        }
        if (result.companies && result.companies.length > 0) {
          setOpen(false);
          form.reset({
            columnMappings: [{ column: "name", excelColumn: "A" }],
            startRow: 1,
            endRow: undefined,
          });
          setPreviewData(null);
          setCurrentStep(1);
          router.refresh();
          toast.success(
            `Successfully imported ${result.totalCreated} company${result.totalCreated !== 1 ? "s" : ""}!`
          );
        }
      } else {
        const errorMessage = result.error || "Failed to import companies";
        form.setError("root", {
          type: "server",
          message: errorMessage,
        });
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage = "An unexpected error occurred";
      form.setError("root", {
        type: "server",
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Step navigation
  const handleNextStep = () => {
    if (currentStep === 1) {
      // Validate at least name is selected (should always be true, but just in case)
      const hasRequired = form.getValues("columnMappings").some(m => m.column === "name");
      if (!hasRequired) {
        toast.error("Company Name is a required column");
        return;
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const selectedColumns = form.watch("columnMappings").map((m) => m.column);
  const file = form.watch("file");
  const hasRequiredColumns = selectedColumns.includes("name");
  const canGoToStep2 = hasRequiredColumns;
  const canImport = hasRequiredColumns && file !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} variant="secondary">
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Add Batch Company (Excel)
      </Button>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Batch Import Companies from Excel</DialogTitle>
          <DialogDescription>
            Import multiple companies at once by uploading an Excel file and mapping your columns.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  currentStep === step
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step}
              </div>
              <span className="text-xs text-center">
                {step === 1 ? "Select Columns" : step === 2 ? "Order & Map Columns" : "Upload File"}
              </span>
              {step < 3 && (
                <div className={`h-1 w-full ${currentStep > step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Scrollable Step Content */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
              {/* Step 1: Select Columns */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Step 1: Select Columns to Import</h3>
                  <div className="space-y-3">
                    <FormDescription>
                      Check the columns you want to import from your Excel file. Company Name is required.
                    </FormDescription>
                    <div className="space-y-2 border border-border rounded-lg p-3 bg-card">
                      {AVAILABLE_COLUMNS.map((column) => (
                        <div
                          key={column.value}
                          className="flex items-start space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            id={`column-${column.value}`}
                            checked={selectedColumns.includes(column.value)}
                            onCheckedChange={(checked) =>
                              handleColumnToggle(column.value, checked as boolean)
                            }
                            disabled={column.required}
                          />
                          <div className="space-y-1 leading-none">
                            <label
                              htmlFor={`column-${column.value}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {column.label}
                              {column.required && <span className="text-destructive ml-1">*</span>}
                            </label>
                            <p className="text-xs text-muted-foreground">{column.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Order & Map Columns */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Step 2: Order & Map Columns</h3>
                  <div className="space-y-3">
                    <FormDescription>
                      Drag to reorder columns and set the corresponding Excel column letter (A, B, AA, etc.) for each.
                    </FormDescription>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={form.getValues("columnMappings").map((m) => m.column)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {form.getValues("columnMappings").map((mapping) => (
                            <SortableColumnItem
                              key={mapping.column}
                              mapping={mapping}
                              onRemove={handleRemoveColumn}
                              onExcelColumnChange={handleExcelColumnChange}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              )}

              {/* Step 3: Upload File & Import */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Step 3: Upload File & Import</h3>

                  {/* Row Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Row Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="startRow"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Row</FormLabel>
                            <FormDescription>First row containing company data</FormDescription>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endRow"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Row (Optional)</FormLabel>
                            <FormDescription>Last row to import (leave empty for all)</FormDescription>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Upload Excel File</h4>
                    <FormField
                      control={form.control}
                      name="file"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div
                              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                                isDraggingOver
                                  ? "border-primary bg-primary/5"
                                  : field.value
                                  ? "border-green-500 bg-green-50/5 dark:bg-green-950/5"
                                  : "border-border hover:border-primary/50 hover:bg-accent/5"
                              }`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDraggingOver(true);
                              }}
                              onDragLeave={() => setIsDraggingOver(false)}
                              onDrop={handleFileDrop}
                              onClick={() => document.getElementById("excel-upload")?.click()}
                            >
                              <input
                                id="excel-upload"
                                type="file"
                                accept=".xlsx"
                                className="hidden"
                                onChange={handleFileChange}
                              />
                              {field.value ? (
                                <div className="space-y-2">
                                  <FileSpreadsheet className="h-10 w-10 text-green-500 mx-auto" />
                                  <p className="font-medium">{field.value.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {(field.value.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      form.setValue("file", undefined as any);
                                    }}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Remove File
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
                                  <p className="font-medium">Drag and drop your Excel file here</p>
                                  <p className="text-sm text-muted-foreground">
                                    or click to browse (only .xlsx files, max 10MB)
                                  </p>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Preview Section */}
                  {previewData && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Preview (First 5 Rows)</h4>
                      <Card>
                        <CardContent className="p-4">
                          <div className="h-[200px] overflow-auto border border-border rounded-md">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-background">
                                <tr className="border-b border-border">
                                  {previewData.headers.map((header, i) => (
                                    <th key={i} className="text-left py-2 px-3 font-medium">
                                      {header || `Column ${String.fromCharCode(65 + i)}`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.rows.map((row, i) => (
                                  <tr key={i} className="border-b border-border/50">
                                    {row.map((cell: any, j: number) => (
                                      <td key={j} className="py-2 px-3">
                                        {cell ?? ""}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {form.formState.errors.root && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">{form.formState.errors.root.message}</p>
                </div>
              )}
            </form>
          </Form>
        </div>

        {/* Navigation Buttons - Fixed at bottom */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {/* Left Side: Back & Cancel */}
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="secondary"
                onClick={handlePreviousStep}
                disabled={isSubmitting}
                size="sm"
                className="gap-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              size="sm"
            >
              Cancel
            </Button>
          </div>

          {/* Right Side: Next or Submit */}
          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={isSubmitting || (currentStep === 1 && !canGoToStep2)}
                className="gap-1"
              >
                Next
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isSubmitting || !canImport}
                className="gap-1"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    Import Companies
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
