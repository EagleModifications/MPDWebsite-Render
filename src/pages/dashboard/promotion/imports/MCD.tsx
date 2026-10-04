import {
  useRef,
  useState,
} from "react"

import {
  Check,
  Clipboard,
  ClipboardPaste,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { logPromotionAction } from "@/lib/promotionActionLog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type ImportResult = {
  success?: boolean
  message?: string
  error?: string
  added?: number
  updated?: number
  imported?: number
  totalMembers?: number
}

const PROMOTION_LOG_DIVISION = "mcd" as const

const IMPORT_ENDPOINT =
  "/api/import/promotion/mcd"

const ALLOWED_EXTENSIONS = [
  "csv",
  "xlsx",
  "xls",
  "txt",
]

const COMMAND_ONE =
  "/hours tag:Metro PD | Major Crimes Division choices:(This Month, Last Month, This Week, Last Week) hidden:(True, False) exportcsv:True"

const COMMAND_TWO =
  "/hours tag:Metro PD | Major Crimes Division choices:Custom Date Range hidden:(True, False) exportcsv:True startstr:MM-DD-YYYY endstr:MM-DD-YYYY"

function getFileExtension(
  fileName: string,
) {
  return fileName
    .split(".")
    .pop()
    ?.toLowerCase()
}

export default function MCDImport() {
  const fileInputRef =
    useRef<HTMLInputElement>(null)

  const [pasteData, setPasteData] =
    useState("")

  const [fileName, setFileName] =
    useState("")

  const [file, setFile] =
    useState<File | null>(null)

  const [isDragging, setIsDragging] =
    useState(false)

  const [isImporting, setIsImporting] =
    useState(false)

  const [copiedCommand, setCopiedCommand] =
    useState<string | null>(null)

  const hasData =
    pasteData.trim().length > 0 ||
    file !== null

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function clearAllData() {
    if (hasData) {
      logPromotionAction({
        action: "clear-import-data",
        category: "import",
        division: PROMOTION_LOG_DIVISION,
        summary: `Cleared ${PROMOTION_LOG_DIVISION.toUpperCase()} promotion import data.`,
      })
    }

    setPasteData("")
    setFileName("")
    setFile(null)

    clearFileInput()
  }

  async function copyCommand(
    command: string,
    commandId: string,
  ) {
    try {
      await navigator.clipboard.writeText(
        command,
      )

      setCopiedCommand(commandId)

      logPromotionAction({
        action: "copy-import-command",
        category: "import",
        division: PROMOTION_LOG_DIVISION,
        summary: `Copied a promotion import command for ${PROMOTION_LOG_DIVISION}.`,
        details: { commandId },
      })

      window.setTimeout(() => {
        setCopiedCommand((current) =>
          current === commandId
            ? null
            : current,
        )
      }, 1800)
    } catch (error) {
      console.error(
        "Failed to copy command:",
        error,
      )

      toast.error(
        "Copy failed",
        {
          description:
            "The command could not be copied to your clipboard.",
        },
      )
    }
  }

  function handleFile(
    selectedFile: File,
  ) {
    const extension =
      getFileExtension(
        selectedFile.name,
      )

    if (
      !extension ||
      !ALLOWED_EXTENSIONS.includes(
        extension,
      )
    ) {
      setFile(null)
      setFileName("")
      setPasteData("")

      clearFileInput()

      toast.error("Invalid file", {
        description:
          "Please upload a CSV, Excel (.xlsx/.xls), or TXT file.",
      })

      return
    }

    setFile(selectedFile)
    setFileName(selectedFile.name)
    setPasteData("")

    if (
      extension === "csv" ||
      extension === "txt"
    ) {
      const reader =
        new FileReader()

      reader.onload = (event) => {
        const result =
          event.target?.result

        if (
          typeof result === "string"
        ) {
          setPasteData(result)
        }
      }

      reader.onerror = () => {
        toast.error(
          "Unable to read file",
          {
            description:
              "The selected file could not be read.",
          },
        )
      }

      reader.readAsText(
        selectedFile,
      )
    }
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    handleFile(selectedFile)
  }

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault()

    setIsDragging(false)

    if (isImporting) {
      return
    }

    const droppedFile =
      event.dataTransfer.files?.[0]

    if (!droppedFile) {
      return
    }

    handleFile(droppedFile)
  }

  async function handleImport() {
    if (
      !hasData ||
      isImporting
    ) {
      return
    }

    setIsImporting(true)

    const loadingToast =
      toast.loading(
        "Importing MCD promotion...",
        {
          description:
            "Please wait while the data is processed.",
        },
      )

    try {
      let response: Response

      if (
        file &&
        !pasteData.trim()
      ) {
        const formData =
          new FormData()

        formData.append(
          "file",
          file,
        )

        response = await fetch(
          IMPORT_ENDPOINT,
          {
            method: "POST",
            body: formData,
            credentials: "include",
            cache: "no-store",
          },
        )
      } else {
        response = await fetch(
          IMPORT_ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            cache: "no-store",
            body: JSON.stringify({
              data: pasteData,
            }),
          },
        )
      }

      const responseText =
        await response.text()

      let result:
        | ImportResult
        | null = null

      if (
        responseText.trim()
      ) {
        try {
          result =
            JSON.parse(
              responseText,
            ) as ImportResult
        } catch {
          result = null
        }
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
            result?.message ||
            responseText ||
            `The MCD import failed with status ${response.status}.`,
        )
      }

      if (
        result?.success === false
      ) {
        throw new Error(
          result.error ||
            result.message ||
            "The MCD import failed.",
        )
      }

      toast.success(
        "MCD import successful",
        {
          id: loadingToast,
          description:
            result?.message ||
            "MCD promotion data was imported successfully.",
        },
      )

      logPromotionAction({
        action: "import-promotion",
        category: "import",
        division: PROMOTION_LOG_DIVISION,
        summary: `Imported ${PROMOTION_LOG_DIVISION.toUpperCase()} promotion data.`,
        details: {
          source: file && !pasteData.trim() ? "file" : "paste",
          fileName: fileName || undefined,
          resultMessage: result?.message || undefined,
          added: result?.added ?? result?.imported ?? undefined,
          updated: result?.updated ?? undefined,
          totalMembers: result?.totalMembers ?? undefined,
        },
      })

      setPasteData("")
      setFileName("")
      setFile(null)

      clearFileInput()
    } catch (error) {
      console.error(
        "MCD import error:",
        error,
      )

      let message =
        "The MCD import failed."

      if (
        error instanceof TypeError
      ) {
        message =
          "Unable to connect to the MPD backend."
      } else if (
        error instanceof Error
      ) {
        message =
          error.message
      }

      toast.error(
        "MCD import failed",
        {
          id: loadingToast,
          description: message,
        },
      )
    } finally {
      setIsImporting(false)
    }
  }

  function handleClearPaste() {
    setPasteData("")
    setFile(null)
    setFileName("")

    clearFileInput()
  }

  function handleClearFile() {
    setFileName("")
    setFile(null)
    setPasteData("")

    clearFileInput()
  }

  return (
    <DashboardLayout>
      <div
        className="
          min-w-0
          max-w-full
          space-y-6
          overflow-x-hidden
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {/* Header */}

        <div>
          <div className="flex items-center gap-3">
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                border-blue-500/20
                bg-blue-500/10
              "
            >
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                MCD Promotion Import
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Import MCD promotion points by Discord ID.
              </p>
            </div>
          </div>
        </div>

        {/* Expected / Command Format */}

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          {/* Expected Format */}

          <section
            className="
              min-w-0
              rounded-xl
              border
              border-border
              bg-card
              p-5
              shadow-sm
            "
          >
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-blue-500/10
                "
              >
                <FileSpreadsheet className="h-4 w-4 text-blue-500" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">
                  Expected Format
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  The MCD promotion import should contain a
                  Discord ID and the member's total promotion points.
                </p>

                <pre
                  className="
                    mt-3
                    max-w-full
                    overflow-x-auto
                    rounded-lg
                    border
                    border-border
                    bg-background
                    p-3
                    font-mono
                    text-xs
                    leading-5
                    text-muted-foreground
                    [scrollbar-width:none]
                    [&::-webkit-scrollbar]:hidden
                  "
                >
{`Discord ID, Promotion Points
123456789012345678, 12
987654321098765432, 8`}
                </pre>
              </div>
            </div>
          </section>

          {/* Command Format */}

          <section
            className="
              min-w-0
              rounded-xl
              border
              border-border
              bg-card
              p-5
              shadow-sm
            "
          >
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-blue-500/10
                "
              >
                <ClipboardPaste className="h-4 w-4 text-blue-500" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">
                  Command Format
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  Use one of the following commands to export
                  MCD promotion data.
                </p>

                <div className="mt-3 space-y-3">
                  {/* Command 1 */}

                  <div
                    className="
                      relative
                      min-w-0
                      rounded-lg
                      border
                      border-border
                      bg-background
                    "
                  >
                    <div
                      className="
                        min-w-0
                        break-words
                        whitespace-normal
                        px-3
                        py-3
                        pr-12
                        font-mono
                        text-xs
                        leading-5
                        text-muted-foreground
                      "
                    >
                      {COMMAND_ONE}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        void copyCommand(
                          COMMAND_ONE,
                          "command-one",
                        )
                      }
                      className="
                        absolute
                        right-1.5
                        top-1.5
                        h-8
                        w-8
                        shrink-0
                        rounded-md
                        text-muted-foreground
                        transition-all
                        duration-200
                        hover:bg-muted
                        hover:text-foreground
                      "
                      aria-label={
                        copiedCommand ===
                        "command-one"
                          ? "Copied"
                          : "Copy command"
                      }
                    >
                      <span
                        className="
                          relative
                          flex
                          h-4
                          w-4
                          items-center
                          justify-center
                        "
                      >
                        <Clipboard
                          className={`
                            absolute
                            h-4
                            w-4
                            transition-all
                            duration-200
                            ${
                              copiedCommand ===
                              "command-one"
                                ? "scale-0 rotate-[-90deg] opacity-0"
                                : "scale-100 rotate-0 opacity-100"
                            }
                          `}
                        />

                        <Check
                          className={`
                            absolute
                            h-4
                            w-4
                            text-emerald-500
                            transition-all
                            duration-200
                            ${
                              copiedCommand ===
                              "command-one"
                                ? "scale-100 rotate-0 opacity-100"
                                : "scale-0 rotate-90 opacity-0"
                            }
                          `}
                        />
                      </span>
                    </Button>
                  </div>

                  {/* Command 2 */}

                  <div
                    className="
                      relative
                      min-w-0
                      rounded-lg
                      border
                      border-border
                      bg-background
                    "
                  >
                    <div
                      className="
                        min-w-0
                        break-words
                        whitespace-normal
                        px-3
                        py-3
                        pr-12
                        font-mono
                        text-xs
                        leading-5
                        text-muted-foreground
                      "
                    >
                      {COMMAND_TWO}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        void copyCommand(
                          COMMAND_TWO,
                          "command-two",
                        )
                      }
                      className="
                        absolute
                        right-1.5
                        top-1.5
                        h-8
                        w-8
                        shrink-0
                        rounded-md
                        text-muted-foreground
                        transition-all
                        duration-200
                        hover:bg-muted
                        hover:text-foreground
                      "
                      aria-label={
                        copiedCommand ===
                        "command-two"
                          ? "Copied"
                          : "Copy command"
                      }
                    >
                      <span
                        className="
                          relative
                          flex
                          h-4
                          w-4
                          items-center
                          justify-center
                        "
                      >
                        <Clipboard
                          className={`
                            absolute
                            h-4
                            w-4
                            transition-all
                            duration-200
                            ${
                              copiedCommand ===
                              "command-two"
                                ? "scale-0 rotate-[-90deg] opacity-0"
                                : "scale-100 rotate-0 opacity-100"
                            }
                          `}
                        />

                        <Check
                          className={`
                            absolute
                            h-4
                            w-4
                            text-emerald-500
                            transition-all
                            duration-200
                            ${
                              copiedCommand ===
                              "command-two"
                                ? "scale-100 rotate-0 opacity-100"
                                : "scale-0 rotate-90 opacity-0"
                            }
                          `}
                        />
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Import Areas */}

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          {/* Paste */}

          <section
            className="
              min-w-0
              rounded-xl
              border
              border-border
              bg-card
              p-6
              shadow-sm
            "
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="h-4 w-4 text-blue-500" />

                  <h2 className="text-lg font-semibold">
                    Paste Data
                  </h2>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Paste the MCD promotion spreadsheet data below.
                </p>
              </div>

              {pasteData && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={
                    handleClearPaste
                  }
                  className="h-8 shrink-0 rounded-md"
                  disabled={isImporting}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>

            <textarea
              value={pasteData}
              onChange={(event) => {
                setPasteData(
                  event.target.value,
                )

                setFile(null)
                setFileName("")

                clearFileInput()
              }}
              placeholder={`Discord ID, Promotion Points
123456789012345678, 12
987654321098765432, 8`}
              spellCheck={false}
              disabled={isImporting}
              className="
                mt-5
                block
                min-h-[300px]
                w-full
                resize-y
                overflow-y-auto
                overflow-x-hidden
                rounded-lg
                border
                border-border
                bg-background
                p-4
                font-mono
                text-xs
                leading-5
                outline-none
                transition-colors
                placeholder:font-mono
                placeholder:text-muted-foreground
                focus:border-blue-500/50
                focus:ring-2
                focus:ring-blue-500/10
                disabled:cursor-not-allowed
                disabled:opacity-60
                [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
              "
            />

            <p className="mt-2 text-xs text-muted-foreground">
              Tab-separated or comma-separated spreadsheet data can
              be pasted here.
            </p>
          </section>

          {/* Upload */}

          <section
            className="
              min-w-0
              rounded-xl
              border
              border-border
              bg-card
              p-6
              shadow-sm
            "
          >
            <div>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-500" />

                <h2 className="text-lg font-semibold">
                  Upload File
                </h2>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Upload a MCD promotion spreadsheet or data file.
              </p>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault()

                if (!isImporting) {
                  setIsDragging(true)
                }
              }}
              onDragLeave={() => {
                setIsDragging(false)
              }}
              onDrop={handleDrop}
              className={`
                mt-5
                flex
                min-h-[300px]
                flex-col
                items-center
                justify-center
                rounded-lg
                border
                border-dashed
                px-6
                text-center
                transition-colors
                ${
                  isDragging
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-border bg-background"
                }
              `}
            >
              <div
                className="
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-full
                  bg-muted
                "
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>

              <h3 className="mt-4 text-sm font-semibold">
                Drop your file here
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                or select a file from your computer
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-md"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={isImporting}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Choose File
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={
                  handleFileChange
                }
                disabled={isImporting}
              />

              <p className="mt-4 text-[11px] text-muted-foreground">
                CSV, XLSX, XLS, or TXT
              </p>
            </div>

            {fileName && (
              <div
                className="
                  mt-4
                  flex
                  items-center
                  justify-between
                  gap-3
                  rounded-lg
                  border
                  border-border
                  bg-muted/30
                  p-3
                "
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="
                      flex
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-md
                      bg-blue-500/10
                    "
                  >
                    <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {fileName}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Ready to import
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-md"
                  onClick={
                    handleClearFile
                  }
                  disabled={isImporting}
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* Import Actions */}

        <section
          className="
            flex
            flex-col
            gap-4
            rounded-xl
            border
            border-border
            bg-card
            p-5
            shadow-sm
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <h2 className="text-sm font-semibold">
              Ready to Import
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Existing Discord IDs will have their promotion points updated.
              New Discord IDs will be added.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-md"
              onClick={clearAllData}
              disabled={
                !hasData ||
                isImporting
              }
            >
              Clear
            </Button>

            <Button
              type="button"
              className="rounded-md"
              disabled={
                !hasData ||
                isImporting
              }
              onClick={() =>
                void handleImport()
              }
            >
              {isImporting ? (
                <>
                  <span
                    className="
                      mr-2
                      h-4
                      w-4
                      animate-spin
                      rounded-full
                      border-2
                      border-current
                      border-t-transparent
                    "
                  />

                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import MCD Promotion
                </>
              )}
            </Button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
