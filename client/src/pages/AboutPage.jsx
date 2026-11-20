import Card from '../components/ui/Card.jsx';

// Placeholder shell for Sprint 5. Expanded with full scoring methodology and check catalogue in Sprint 7.
export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">About SEOCheck</h1>
        <p className="mt-1 text-sm text-slate-600">
          Transparent, rule-based on-page and technical SEO auditing.
        </p>
      </div>

      <Card title="Educational Disclaimer">
        <p className="text-sm leading-relaxed text-slate-700">
          SEOCheck calculates an <strong>educational audit score</strong> out of 100 based on 18 documented on-page
          and technical checks. It is not an official Google ranking formula or search engine score.
        </p>
      </Card>
    </div>
  );
}
