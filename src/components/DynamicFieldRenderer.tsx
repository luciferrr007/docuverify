
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FieldDef {
  name: string;
  label: string;
  type?: string;
  readOnly?: boolean;
}

interface DynamicFieldRendererProps {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const DynamicFieldRenderer = ({
  fields,
  values,
  onChange,
}: DynamicFieldRendererProps) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {fields.map((field) => (
      <div key={field.name} className="space-y-1.5">
        <Label
          htmlFor={field.name}
          className="text-sm font-medium text-foreground"
        >
          {field.label}
        </Label>

        <Input
          id={field.name}
          type={field.type || "text"}
          placeholder={field.label}
          value={values[field.name] || ""}
          onChange={(event) =>
            onChange(field.name, event.target.value)
          }
          readOnly={field.readOnly === true}
          className="transition-colors focus:border-primary focus:ring-primary"
        />
      </div>
    ))}
  </div>
);

export default DynamicFieldRenderer;
