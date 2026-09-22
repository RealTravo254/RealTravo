import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads an image file to the `destination-images` bucket and writes the
 * resulting public URL onto the matching `countries` or `country_divisions`
 * row's `image_url` column. Use this from whatever admin/host screen manages
 * countries and regions.
 *
 * Example:
 *   await uploadDestinationImage({ table: "countries", id: country.id, file });
 *   await uploadDestinationImage({ table: "country_divisions", id: division.id, file });
 */
export async function uploadDestinationImage({
  table,
  id,
  file,
}: {
  table: "countries" | "country_divisions";
  id: string;
  file: File;
}) {
  const folder = table === "countries" ? "countries" : "divisions";
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${id}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("destination-images")
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("destination-images")
    .getPublicUrl(path);

  const { error: updateError } = await supabase
    .from(table)
    .update({ image_url: publicUrlData.publicUrl })
    .eq("id", id);

  if (updateError) throw updateError;

  return publicUrlData.publicUrl;
}