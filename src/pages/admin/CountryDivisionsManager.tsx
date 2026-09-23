// src/pages/admin/CountryDivisionsManager.tsx
//
// Admin-only page for managing the `countries` and `country_divisions`
// tables referenced elsewhere in the app (see the DB-requirements comment
// block at the top of src/pages/Index.tsx). Lets an admin:
//   - add / edit / delete countries (name, ISO code, image)
//   - pick a country and add / edit / delete its divisions (name, image)
//
// Admin check mirrors AccountPage.tsx: a row in `user_roles` with
// role = 'admin' for this user, falling back to app_metadata/user_metadata.
//
// ASSUMPTION — adjust if it doesn't match your project:
//   Image storage: uploads go to a Supabase Storage bucket named
//   "location-images", under "countries/" and "divisions/" prefixes.
//   Rename STORAGE_BUCKET if your bucket has a different name.

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Globe,
  ImageOff,
  ChevronLeft,
} from "lucide-react";

const STORAGE_BUCKET = "location-images";

interface Country {
  id: string;
  name: string;
  iso_code: string | null;
  image_url: string | null;
}

interface Division {
  id: string;
  country_id: string;
  name: string;
  image_url: string | null;
}

type DialogMode = { kind: "country" | "division"; item: Country | Division | null } | null;

async function uploadImage(file: File, prefix: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function CountryDivisionsManager() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formIso, setFormIso] = useState("");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "country" | "division"; item: Country | Division } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  // ── Admin guard ────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    (async () => {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const admin =
        !!roleRow || user.app_metadata?.role === "admin" || !!user.user_metadata?.is_admin;

      if (!admin) {
        toast({ title: "Not authorized", description: "This page is admin-only.", variant: "destructive" });
        navigate("/");
        return;
      }
      setIsAdmin(true);
      setCheckingAdmin(false);
    })();
  }, [user, authLoading, navigate, toast]);

  // ── Fetch countries ────────────────────────────────────────────────────
  const fetchCountries = useCallback(async () => {
    setLoadingCountries(true);
    const { data, error } = await supabase
      .from("countries")
      .select("id, name, iso_code, image_url")
      .order("name", { ascending: true });
    if (error) {
      toast({ title: "Couldn't load countries", description: error.message, variant: "destructive" });
    } else {
      setCountries(data || []);
    }
    setLoadingCountries(false);
  }, [toast]);

  useEffect(() => {
    if (isAdmin) fetchCountries();
  }, [isAdmin, fetchCountries]);

  // ── Fetch divisions for selected country ──────────────────────────────
  const fetchDivisions = useCallback(
    async (countryId: string) => {
      setLoadingDivisions(true);
      const { data, error } = await supabase
        .from("country_divisions")
        .select("id, country_id, name, image_url")
        .eq("country_id", countryId)
        .order("name", { ascending: true });
      if (error) {
        toast({ title: "Couldn't load divisions", description: error.message, variant: "destructive" });
      } else {
        setDivisions(data || []);
      }
      setLoadingDivisions(false);
    },
    [toast],
  );

  useEffect(() => {
    if (selectedCountry) fetchDivisions(selectedCountry.id);
    else setDivisions([]);
  }, [selectedCountry, fetchDivisions]);

  // ── Dialog helpers ─────────────────────────────────────────────────────
  const openAddCountry = () => {
    setFormName("");
    setFormIso("");
    setFormImageFile(null);
    setFormImagePreview(null);
    setDialog({ kind: "country", item: null });
  };

  const openEditCountry = (c: Country) => {
    setFormName(c.name);
    setFormIso(c.iso_code || "");
    setFormImageFile(null);
    setFormImagePreview(c.image_url);
    setDialog({ kind: "country", item: c });
  };

  const openAddDivision = () => {
    setFormName("");
    setFormImageFile(null);
    setFormImagePreview(null);
    setDialog({ kind: "division", item: null });
  };

  const openEditDivision = (d: Division) => {
    setFormName(d.name);
    setFormImageFile(null);
    setFormImagePreview(d.image_url);
    setDialog({ kind: "division", item: d });
  };

  const closeDialog = () => {
    setDialog(null);
    setFormName("");
    setFormIso("");
    setFormImageFile(null);
    setFormImagePreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormImageFile(file);
    setFormImagePreview(URL.createObjectURL(file));
  };

  const handleSaveDialog = async () => {
    if (!dialog) return;
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setDialogSaving(true);
    try {
      let imageUrl = dialog.item?.image_url ?? null;
      if (formImageFile) {
        imageUrl = await uploadImage(
          formImageFile,
          dialog.kind === "country" ? "countries" : "divisions",
        );
      }

      if (dialog.kind === "country") {
        const payload = { name: formName.trim(), iso_code: formIso.trim() || null, image_url: imageUrl };
        if (dialog.item) {
          const { error } = await supabase.from("countries").update(payload).eq("id", dialog.item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("countries").insert(payload);
          if (error) throw error;
        }
        toast({ title: "Saved", description: "Country saved." });
        await fetchCountries();
      } else {
        if (!selectedCountry) return;
        const payload = { name: formName.trim(), image_url: imageUrl, country_id: selectedCountry.id };
        if (dialog.item) {
          const { error } = await supabase.from("country_divisions").update(payload).eq("id", dialog.item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("country_divisions").insert(payload);
          if (error) throw error;
        }
        toast({ title: "Saved", description: "Division saved." });
        await fetchDivisions(selectedCountry.id);
      }
      closeDialog();
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    } finally {
      setDialogSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const table = deleteTarget.kind === "country" ? "countries" : "country_divisions";
      const { error } = await supabase.from(table).delete().eq("id", deleteTarget.item.id);
      if (error) throw error;
      toast({ title: "Deleted" });
      if (deleteTarget.kind === "country") {
        if (selectedCountry?.id === deleteTarget.item.id) setSelectedCountry(null);
        await fetchCountries();
      } else if (selectedCountry) {
        await fetchDivisions(selectedCountry.id);
      }
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Couldn't delete", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Countries &amp; Divisions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage the regions shown in the "Explore" section of the homepage.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* ── Countries panel ── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Countries
              </h2>
              <Button size="sm" onClick={openAddCountry} className="h-8 px-3 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>

            {loadingCountries ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : countries.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No countries yet.</p>
            ) : (
              <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                {countries.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => setSelectedCountry(c)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      selectedCountry?.id === c.id ? "bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                      {c.image_url ? (
                        <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.iso_code || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditCountry(c); }}
                        className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                        aria-label="Edit country"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ kind: "country", item: c }); }}
                        className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-destructive/10 transition-colors"
                        aria-label="Delete country"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Divisions panel ── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {selectedCountry ? `Divisions · ${selectedCountry.name}` : "Divisions"}
              </h2>
              {selectedCountry && (
                <Button size="sm" onClick={openAddDivision} className="h-8 px-3 text-xs font-semibold">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              )}
            </div>

            {!selectedCountry ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Select a country on the left to manage its divisions.
              </div>
            ) : loadingDivisions ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : divisions.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No divisions yet for this country.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                {divisions.map((d) => (
                  <div key={d.id} className="rounded-xl border border-border overflow-hidden group">
                    <div className="relative aspect-square bg-muted">
                      {d.image_url ? (
                        <img src={d.image_url} alt={d.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ImageOff className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => openEditDivision(d)}
                          className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center"
                          aria-label="Edit division"
                        >
                          <Pencil className="h-3.5 w-3.5 text-foreground" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ kind: "division", item: d })}
                          className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center"
                          aria-label="Delete division"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-foreground px-2 py-1.5 truncate">{d.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedCountry && (
          <button
            onClick={() => setSelectedCountry(null)}
            className="lg:hidden flex items-center gap-1 text-xs font-semibold text-muted-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to countries
          </button>
        )}
      </div>

      {/* ── Add/Edit dialog (shared by country + division) ── */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.item ? "Edit" : "Add"} {dialog?.kind === "country" ? "country" : "division"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === "country"
                ? "Set the country's name, ISO code, and cover image."
                : `Set the division's name and image, under ${selectedCountry?.name}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={dialog?.kind === "country" ? "e.g. Kenya" : "e.g. Nairobi"}
                className="h-9 text-sm"
                autoFocus
              />
            </div>

            {dialog?.kind === "country" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ISO code</Label>
                <Input
                  value={formIso}
                  onChange={(e) => setFormIso(e.target.value.toUpperCase())}
                  placeholder="e.g. KE"
                  maxLength={2}
                  className="h-9 text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Image</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                  {formImagePreview ? (
                    <img src={formImagePreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs font-semibold"
                >
                  Choose image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={closeDialog} className="flex-1">
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveDialog} disabled={dialogSaving} className="flex-1">
              {dialogSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.kind === "country" ? "country" : "division"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "country"
                ? "This also removes access to its divisions from the app. This can't be undone."
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}