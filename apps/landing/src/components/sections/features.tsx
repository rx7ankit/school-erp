import { Heading } from "@/components/heading";
import { Eyebrow } from "@/components/section";
import { FeatureRow } from "@/components/feature-row";
import { AttendanceMockup } from "@/components/mockups/attendance";
import { StudentProfileMockup } from "@/components/mockups/student-profile";
import { FeesMockup } from "@/components/mockups/fees";
import { ResultsMockup } from "@/components/mockups/results";
import { StaffMockup } from "@/components/mockups/staff";

export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="px-4 py-12 sm:px-6 md:py-16">
      <div className="mx-auto w-full max-w-[1200px]">
        <Eyebrow>Features</Eyebrow>
        <Heading id="features-heading" lead="Everything the school office does." dim="Without the paperwork." className="max-w-3xl" />

        <div className="mt-6 flex flex-col">
          <FeatureRow
            id="attendance"
            eyebrow="Attendance"
            lead="Mark a class in a minute."
            dim="Half‑days included."
            body="The class teacher marks the morning and afternoon separately. Present and absent in either order counts as a half-day, and attendance percentages are worked out for you."
            points={[
              "Half-days counted as 0.5, leave shown separately",
              "Attendance percentage per student and per class",
              "Holidays are left out of the working days",
              "Students who have left are never marked again",
            ]}
            visual={<AttendanceMockup />}
          />
          <FeatureRow
            id="students"
            eyebrow="Students"
            lead="A full history for every student."
            dim="From admission onwards."
            body="Admissions, class changes, promotions and leaving school are written to a timeline on the profile, with the date, reason and who recorded it."
            points={[
              "Mark a student as left with a date and reason. The history stays",
              "Year-end promotion for the whole school, with a decision per student",
              "Admissions, and import students from an Excel file",
              "A student can rejoin later without losing the past",
            ]}
            visual={<StudentProfileMockup />}
            flip
          />
          <FeatureRow
            id="fees"
            eyebrow="Fees"
            lead="Collected at the counter."
            dim="Recorded in seconds."
            body="Parents pay at school, the way they always have. Staff with fees access record the payment and print a receipt. Dues and collections are always up to date."
            points={[
              "Cash, cheque, UPI or bank transfer, recorded as received at school",
              "A receipt number for every payment",
              "Pending dues visible per student and per class",
              "Only staff with fees access can see or change fees",
            ]}
            visual={<FeesMockup />}
          />
          <FeatureRow
            id="results"
            eyebrow="Results and messages"
            lead="Publish when you are ready."
            dim="Talk to parents directly."
            body="The class teacher enters marks and remarks. Parents see nothing until the class teacher publishes, and unpublishing hides it again. Teachers can also reach parents without sharing phone numbers."
            points={[
              "Results go live for parents only when published",
              "Class broadcasts, sent subject by subject",
              "Personal messages between a parent and a teacher",
              "Notices and a holiday calendar for the whole school",
            ]}
            visual={<ResultsMockup />}
            flip
          />
          <FeatureRow
            id="staff"
            eyebrow="Staff and permissions"
            lead="Everyone sees what they need."
            dim="Nothing more."
            body="The staff directory holds each person's role and class. Access is given with four clear permissions, so the accountant sees fees and the librarian sees the library."
            points={[
              "Fees, library, staff and academic permissions, in any combination",
              "Class teachers mark attendance and publish results for their class",
              "Subject teachers message their own class",
              "Changes to money, attendance, results and permissions are logged",
            ]}
            visual={<StaffMockup />}
          />
        </div>
      </div>
    </section>
  );
}
