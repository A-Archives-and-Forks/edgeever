import type { PluginSettingField } from "@edgeever/plugin-api";

export interface PluginSettingFieldGroup {
  id: string;
  compact: boolean;
  fields: PluginSettingField[];
}

const fieldNamespace = (field: PluginSettingField) => field.key.split(".", 1)[0] ?? field.key;

export const groupPluginSettingFields = (fields: PluginSettingField[]): PluginSettingFieldGroup[] => {
  const groups: PluginSettingFieldGroup[] = [];
  for (let index = 0; index < fields.length;) {
    const field = fields[index]!;
    if (field.type !== "boolean") {
      groups.push({ id: field.key, compact: false, fields: [field] });
      index += 1;
      continue;
    }

    const namespace = fieldNamespace(field);
    let end = index + 1;
    while (end < fields.length && fields[end]!.type === "boolean" && fieldNamespace(fields[end]!) === namespace) end += 1;
    const run = fields.slice(index, end);
    if (run.length >= 3) groups.push({ id: `${namespace}:${field.key}`, compact: true, fields: run });
    else for (const item of run) groups.push({ id: item.key, compact: false, fields: [item] });
    index = end;
  }
  return groups;
};
