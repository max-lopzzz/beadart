interface SourceTypeStepProps {
  onSelect: (sourceType: 'digital' | 'photo') => void;
}

export function SourceTypeStep({ onSelect }: SourceTypeStepProps) {
  return (
    <div>
      <h2>What are you uploading?</h2>
      <button onClick={() => onSelect('digital')}>Digital pixel art image</button>
      <button onClick={() => onSelect('photo')}>Photo of a drawing</button>
    </div>
  );
}
