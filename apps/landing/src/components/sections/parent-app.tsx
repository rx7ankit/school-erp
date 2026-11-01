import { Heading } from "@/components/heading";
import { Section, Eyebrow } from "@/components/section";
import { ParentHomePhone, ParentResultsPhone } from "@/components/mockups/parent-phone";

export function ParentApp() {
  return (
    <Section id="parents" labelledBy="parents-heading" panel>
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Parent app</Eyebrow>
        <Heading id="parents-heading" lead="Parents stay in the loop." dim="Without chasing the school." />
        <p className="mx-auto mt-5 max-w-2xl text-[18px] leading-[1.6] text-text-secondary">
          Parents get a simple app for iPhone and Android, and the same view on the web. Attendance, results, fees, notices and messages, in one place.
        </p>
      </div>

      <div className="mt-12 flex flex-col items-center justify-center gap-6 md:flex-row md:items-start md:gap-10">
        <ParentHomePhone />
        <ParentResultsPhone className="md:mt-12" />
      </div>

      <ul className="mx-auto mt-12 grid max-w-4xl gap-4 text-left md:grid-cols-3">
        <li className="rounded-[20px] bg-bg p-6">
          <h3 className="text-[18px] font-bold tracking-[-0.01em]">One login, several children</h3>
          <p className="mt-2 text-[15px] leading-[1.55] text-text-secondary">
            If one email is used for more than one child, parents sign in once and switch between children inside the app.
          </p>
        </li>
        <li className="rounded-[20px] bg-bg p-6">
          <h3 className="text-[18px] font-bold tracking-[-0.01em]">Login sent in one click</h3>
          <p className="mt-2 text-[15px] leading-[1.55] text-text-secondary">
            The school sends each parent their login by email in one click. Parents set their own password at first sign in.
          </p>
        </li>
        <li className="rounded-[20px] bg-bg p-6">
          <h3 className="text-[18px] font-bold tracking-[-0.01em]">Only their own child</h3>
          <p className="mt-2 text-[15px] leading-[1.55] text-text-secondary">
            A parent can only see their own children. Results appear only after the class teacher publishes them.
          </p>
        </li>
      </ul>
    </Section>
  );
}
