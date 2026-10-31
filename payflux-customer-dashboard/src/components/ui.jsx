export const Toggle = ({ on, onChange, label }) => (
  <button className="sw" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
);
export const Skeleton = ({ h }) => <div className="sk" style={{ height: h }} />;
export const Card = ({ title, children, right, label }) => (
  <section className="card" aria-label={label}>
    {title && (
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="h2 !mb-0">{title}</h2>{right}
      </div>
    )}
    {children}
  </section>
);
