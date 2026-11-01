"use client";

import { Heading } from "@/components/heading";
import { Eyebrow } from "@/components/section";
import { FeatureRow } from "@/components/feature-row";
import { AttendanceMockup } from "@/components/mockups/attendance";
import { StudentProfileMockup } from "@/components/mockups/student-profile";
import { FeesMockup } from "@/components/mockups/fees";
import { ResultsMockup } from "@/components/mockups/results";
import { NotificationsMockup } from "@/components/mockups/notifications";
import { StaffMockup } from "@/components/mockups/staff";
import { useT } from "@/lib/i18n";

export function Features() {
  const t = useT().features;
  return (
    <section id="features" aria-labelledby="features-heading" className="px-4 py-12 sm:px-6 md:py-16">
      <div className="mx-auto w-full max-w-[1200px]">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <Heading id="features-heading" lead={t.lead} dim={t.dim} className="max-w-3xl" />
        <div className="mt-6 flex flex-col">
          <FeatureRow id="attendance" {...t.attendance} visual={<AttendanceMockup />} />
          <FeatureRow id="students" {...t.students} visual={<StudentProfileMockup />} flip />
          <FeatureRow id="fees" {...t.fees} visual={<FeesMockup />} />
          <FeatureRow id="results" {...t.results} visual={<ResultsMockup />} flip />
          <FeatureRow id="notify" {...t.notify} visual={<NotificationsMockup />} />
          <FeatureRow id="staff" {...t.staff} visual={<StaffMockup />} flip />
        </div>
      </div>
    </section>
  );
}
