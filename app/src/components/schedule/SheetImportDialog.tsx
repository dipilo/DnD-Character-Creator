import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileSpreadsheet, ListChecks, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchIntakeTemplate,
  fetchSheetColumns,
  previewSheetImport,
  runSheetImport,
} from '@/lib/api';
import type { IntakeField, SheetMapping, SheetPreview, SheetIntakeTemplate } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

interface SheetImportDialogProps {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the fresh roster once an import lands. */
  onImported: () => void;
}

/**
 * Google's own "make a copy" URL, which only exists for a document's *own* id.
 *
 * A published form (`/forms/d/e/<token>/viewform`) and a `forms.gle` short link both carry a
 * response token rather than the document id, so neither can become a `/copy`. The suffix swap
 * this replaced silently returned those unchanged, sending the DM to fill in the deployment's
 * live form instead of copying it. They link through as-is and the button says so.
 */
function toCopyUrl(url: string): { href: string; copyable: boolean } {
  const match = /^(https:\/\/docs\.google\.com\/(?:spreadsheets|forms|document)\/d\/)(?!e\/)([\w-]{20,})/.exec(url);
  if (!match) return { href: url, copyable: false };
  return { href: `${match[1]}${match[2]}/copy`, copyable: true };
}

const NOT_MAPPED = '__none__';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'The server refused the request.';
}

function TemplateLinks({ templates }: Readonly<{ templates: SheetIntakeTemplate['templates'] }>) {
  if (!templates.sheet && !templates.form) {
    return (
      <Alert>
        <AlertTitle>No template is configured for this deployment</AlertTitle>
        <AlertDescription>
          Paste any spreadsheet below and map its columns by hand. To offer a one-click template,
          set <code>SHEET_TEMPLATE_URL</code> and <code>FORM_TEMPLATE_URL</code> on the server.
        </AlertDescription>
      </Alert>
    );
  }

  const form = templates.form ? toCopyUrl(templates.form) : null;
  const sheet = templates.sheet ? toCopyUrl(templates.sheet) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {form ? (
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <a href={form.href} target="_blank" rel="noreferrer noopener">
              <ListChecks className="h-4 w-4" />
              {form.copyable ? 'Copy the intake form' : 'Open the intake form'}
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </Button>
        ) : null}
        {sheet ? (
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <a href={sheet.href} target="_blank" rel="noreferrer noopener">
              <FileSpreadsheet className="h-4 w-4" />
              {sheet.copyable ? 'Copy the spreadsheet' : 'Open the spreadsheet'}
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </Button>
        ) : null}
      </div>
      {(form && !form.copyable) || (sheet && !sheet.copyable) ? (
        <p className="text-xs text-muted-foreground">
          One of these links opens the original rather than a copy — a short link or a published
          form URL carries a response token, not the document id. Use{' '}
          <strong>File &rarr; Make a copy</strong> once it opens.
        </p>
      ) : null}
    </div>
  );
}

function PlanSummary({ preview }: Readonly<{ preview: SheetPreview }>) {
  const claimed = preview.detail.updates.filter((u) => u.claimed).length;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">{preview.created} new</Badge>
        <Badge variant="secondary">{preview.updated} updated</Badge>
        <Badge variant="outline">{preview.skipped} unchanged</Badge>
      </div>

      {claimed > 0 ? (
        <p className="text-xs text-muted-foreground">
          {claimed} of the updated {claimed === 1 ? 'seat is' : 'seats are'} claimed by a signed-in
          player. Their name and Discord handle are left alone; only what they said about playing
          is updated.
        </p>
      ) : null}

      {preview.detail.creates.length > 0 ? (
        <div>
          <p className="text-sm font-medium">New seats</p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {preview.detail.creates.map((c) => (
              <li key={`create-${c.row}`}>Row {c.row}: {c.name || c.discord}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.detail.updates.length > 0 ? (
        <div>
          <p className="text-sm font-medium">Updated seats</p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {preview.detail.updates.map((u) => (
              <li key={`update-${u.row}`}>
                Row {u.row} to {u.seat_name ?? `#${u.seat_id}`}: {u.columns.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Copy a template, paste the sheet, check the mapping, look at what it will do, then do it.
 *
 * The preview step is not decoration. The importer this replaced wrote immediately and keyed seats
 * off the sheet's row index, so a mistake was discovered by finding someone else's roster gone.
 * Nothing here writes until the DM has seen a plan naming every seat it would touch.
 */
export function SheetImportDialog({ campaignId, open, onOpenChange, onImported }: Readonly<SheetImportDialogProps>) {
  const [template, setTemplate] = useState<SheetIntakeTemplate | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [mapping, setMapping] = useState<SheetMapping>({});
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [busy, setBusy] = useState<'columns' | 'preview' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || template) return;
    fetchIntakeTemplate()
      .then(setTemplate)
      .catch((e) => setError(errorMessage(e)));
  }, [open, template]);

  const fields: IntakeField[] = template?.fields ?? [];

  const loadColumns = useCallback(() => {
    setBusy('columns');
    setError(null);
    setPreview(null);
    fetchSheetColumns(sheetUrl)
      .then((result) => {
        setHeaders(result.headers);
        setMapping(result.mapping);
        setMissingRequired(result.missingRequired);
        setBusy(null);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setHeaders(null);
        setBusy(null);
      });
  }, [sheetUrl]);

  const loadPreview = useCallback(() => {
    setBusy('preview');
    setError(null);
    previewSheetImport({ campaign_id: campaignId, spreadsheetId: sheetUrl, mapping })
      .then((result) => {
        setPreview(result);
        setBusy(null);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setBusy(null);
      });
  }, [campaignId, sheetUrl, mapping]);

  const apply = useCallback(() => {
    setBusy('import');
    setError(null);
    runSheetImport({ campaign_id: campaignId, spreadsheetId: sheetUrl, mapping })
      .then((result) => {
        toast.success(`Imported ${result.created} new and ${result.updated} updated ${result.created + result.updated === 1 ? 'seat' : 'seats'}`);
        setBusy(null);
        onImported();
        onOpenChange(false);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setBusy(null);
      });
  }, [campaignId, sheetUrl, mapping, onImported, onOpenChange]);

  const chooseHeader = (fieldKey: string, header: string) => {
    setPreview(null);
    setMapping((current) => {
      const next = { ...current };
      if (header === NOT_MAPPED) delete next[fieldKey];
      else next[fieldKey] = header;
      return next;
    });
  };

  const missingLabels = missingRequired
    .map((key) => fields.find((f) => f.key === key)?.label ?? key)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import seats from a sheet</DialogTitle>
          <DialogDescription>
            Copy the template, share it with your players, then point this at the responses.
            Re-importing updates the seats it already created rather than duplicating them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {template ? <TemplateLinks templates={template.templates} /> : null}

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="sheet-url">Spreadsheet link</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="sheet-url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
              <Button
                variant="secondary"
                className="min-h-11 shrink-0"
                disabled={!sheetUrl.trim() || busy !== null}
                onClick={loadColumns}
              >
                {busy === 'columns' ? <Spinner className="size-4" /> : <RefreshCw className="h-4 w-4" />}
                Read columns
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The sheet must be shared as "anyone with the link can view" — the server reads it
              anonymously and cannot sign in to your Drive.
            </p>
          </div>

          {missingRequired.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Some required questions were not found</AlertTitle>
              <AlertDescription>
                Nothing matched {missingLabels}. Map them below, or check the sheet still has the
                template's headers.
              </AlertDescription>
            </Alert>
          ) : null}

          {headers ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Column mapping</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={`map-${field.key}`} className="text-xs">
                      {field.label}
                      {field.required ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    <Select value={mapping[field.key] ?? NOT_MAPPED} onValueChange={(v) => chooseHeader(field.key, v)}>
                      <SelectTrigger id={`map-${field.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOT_MAPPED}>Not in this sheet</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {preview ? <PlanSummary preview={preview} /> : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={!headers || busy !== null}
            onClick={loadPreview}
          >
            {busy === 'preview' ? <Spinner className="size-4" /> : null}
            Preview
          </Button>
          <Button className="min-h-11" disabled={!preview || busy !== null} onClick={apply}>
            {busy === 'import' ? <Spinner className="size-4" /> : null}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
