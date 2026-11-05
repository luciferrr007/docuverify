interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

const StepIndicator = ({ steps, currentStep }: StepIndicatorProps) => (
  <div className="flex items-center justify-center gap-2">
    {steps.map((step, index) => (
      <div key={step} className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              index <= currentStep
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {index + 1}
          </div>
          <span
            className={`hidden text-sm font-medium sm:inline ${
              index <= currentStep ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {step}
          </span>
        </div>
        {index < steps.length - 1 && (
          <div
            className={`h-px w-8 transition-colors ${
              index < currentStep ? "bg-primary" : "bg-border"
            }`}
          />
        )}
      </div>
    ))}
  </div>
);

export default StepIndicator;
