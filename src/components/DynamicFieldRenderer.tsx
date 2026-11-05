import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FieldDef {
  name: string;
  label: string;
  type?: string;
}

interface DynamicFieldRendererProps {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const DynamicFieldRenderer = ({ fields, values, onChange }: DynamicFieldRendererProps) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {fields.map((f) => (
      <div key={f.name} className="space-y-1.5">
        <Label htmlFor={f.name} className="text-sm font-medium text-foreground">
          {f.label}
        </Label>
        <Input
          id={f.name}
          type={f.type || "text"}
          placeholder={f.label}
          value={values[f.name] || ""}
          onChange={(e) => onChange(f.name, e.target.value)}
          className="transition-colors focus:border-primary focus:ring-primary"
        />
      </div>
    ))}
  </div>
);

export default DynamicFieldRenderer;
