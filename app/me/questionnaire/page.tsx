import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client-shell";
import { requireClientPage } from "@/lib/auth/client-page";
import { loadLatestQuestionnaire, questionnaireIsOpen } from "@/lib/questionnaire/access";
import { inferredGoalFromTraining } from "@/lib/nutrition/questionnaire";
import { QuestionnaireForm } from "./questionnaire-form";

export default async function ClientQuestionnairePage() {
  const { supabase, client } = await requireClientPage();
  const response = await loadLatestQuestionnaire(supabase, client.id);
  if (!questionnaireIsOpen(response)) redirect("/me");

  return (
    <ClientShell name={`${client.first_name} ${client.last_name}`} active="questionnaire">
      <h1 className="text-3xl">Intake questionnaire</h1>
      <p className="mt-1 font-sans text-sm text-[var(--muted)]">
        {response?.answers && Object.keys(response.answers).length
          ? "Your practitioner asked for an update. Previous answers are filled in — change anything that is no longer right."
          : "Answer what you can. Injuries and health take priority over test numbers. The last sections set your nutrition target and meal list."}
      </p>
      <QuestionnaireForm
        responseId={response?.id ?? null}
        answers={{
          nutrition_goal: inferredGoalFromTraining(response?.answers?.primary_goal),
          ...(response?.answers ?? {}),
        }}
      />
    </ClientShell>
  );
}
