// Transformă o cerere din baza de date în listă „întrebare → răspuns” (în română),
// folosită pentru mesajul Telegram și pentru trimiterea în franciza-crm.
import { dict, optionLabel } from './i18n';
import { sourceText, sourceLabels } from './source';

const ro = (k) => dict.ro[k] ?? k;
const yn = (b) => (b === true ? 'Da' : b === false ? 'Nu' : '—');

// Întrebările exact ca în formularul Google, ca CRM-ul să le recunoască la fel.
export function leadAnswers(lead) {
  return [
    { q: 'Nume/Prenume', a: lead.name },
    { q: 'Număr de telefon', a: lead.phone },
    { q: 'Adresa de e-mail', a: lead.email },
    { q: 'Orașul din care planificați să activați', a: lead.city },
    { q: 'Ce vârstă aveți?', a: lead.age != null ? String(lead.age) : '' },
    { q: 'Câte ore pe zi intenționați să dedicați acestei activități?', a: optionLabel(ro, 'hours', lead.hours) },
    { q: 'Aveți experiență în turism?', a: yn(lead.exp_tourism) },
    { q: 'Aveți experiență în vânzări sau în relații cu clienții?', a: yn(lead.exp_sales) },
    {
      q: 'Descrieți experiența profesională: în ce domeniu a-ți lucrat, pe ce poziție și pentru cât timp',
      a: lead.experience,
    },
    { q: 'Ce te-a atras cel mai mult la această oportunitate?', a: optionLabel(ro, 'attraction', lead.attraction) },
    {
      q: 'Care este bugetul estimat pe care îl aveți disponibil pentru a începe afacerea?',
      a: optionLabel(ro, 'budget', lead.budget),
    },
    { q: 'Care este sursa principală a bugetului?', a: optionLabel(ro, 'budget_source', lead.budget_source) },
    { q: 'Când sunteți gata să începeți?', a: optionLabel(ro, 'start_when', lead.start_when) },
    ...(lead.comment ? [{ q: 'Întrebări sau comentarii', a: lead.comment }] : []),
    {
      q: 'Sursa cererii',
      a: `Site franciză (${(lead.lang || 'ro').toUpperCase()}) · ${sourceText(lead.source, lead.utm, sourceLabels(ro))}`,
    },
  ];
}
