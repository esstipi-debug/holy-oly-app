import { P, Bullets, Section, Note, Defs, Contact, Summary } from "./legalUi";

/** Terms of Service — English version (1:1 with termsContent.tsx). */
export function TermsContentEn() {
  return (
    <>
      <P>
        These Terms of Service (the “Terms”) are the agreement between you and Holy Oly governing the use of
        the application and associated services (the “Service”). By creating an account or using the Service,
        you accept these Terms and our Privacy Policy. If you do not agree, do not use the Service.
      </P>

      <Summary
        title="At a glance"
        items={[
          "Holy Oly is a tool to coordinate training between a coach and an athlete. It is not a medical service and does not handle emergencies.",
          "The coach decides the programming; the athlete reports honestly and listens to their body. Strength training carries risks that you assume.",
          "Your data is yours: you can export or delete it whenever you want.",
          "Subscriptions are paid by coaches; athletes do not pay to link with a coach.",
          "Nothing in these Terms limits the non-waivable rights granted to you by the law of your country.",
        ]}
      />

      <Section n={1} id="aceptacion" title="Acceptance and parties">
        <P>
          The Service is operated by Holy Oly, through its owner (full registration details available on
          request at <Contact />). These Terms apply to everyone who uses the Service. If you use it on behalf
          of an organization, you represent that you have authority to bind it.
        </P>
      </Section>

      <Section n={2} id="definiciones" title="Definitions">
        <Defs
          items={[
            ["Service", "the Holy Oly application, its API and associated features."],
            ["Coach", "a person who uses the Service to program and monitor the training of their athletes."],
            ["Athlete", "a person who uses the Service to view their plan, train and report their status."],
            ["Link", "the relationship, accepted by both parties, that connects a coach with an athlete within the Service."],
            ["User content", "the data you upload (training, check-in, cycle, etc.)."],
          ]}
        />
      </Section>

      <Section n={3} id="servicio" title="Description of the service">
        <P>
          Holy Oly is a sports-coordination tool between coach and athlete: macrocycle planning, prescription,
          progress tracking and optional wellness and cycle context. <strong>It is not a medical, nutritional
          or emergency service</strong>, and it does not replace the advice of health professionals.
        </P>
      </Section>

      <Section n={4} id="elegibilidad" title="Eligibility and age">
        <P>
          To use the Service you must be of legal age or have the authorization and supervision of your legal
          guardian. The Service is not directed to anyone under 18.
        </P>
      </Section>

      <Section n={5} id="cuenta" title="Your account">
        <Bullets
          items={[
            "You are responsible for the accuracy of the data you upload and for keeping your information up to date.",
            "You are responsible for the confidentiality of your password and for all activity carried out with your account.",
            "Notify us without delay if you suspect unauthorized use of your account.",
          ]}
        />
      </Section>

      <Section n={6} id="roles" title="Roles and responsibilities">
        <Bullets
          items={[
            <><strong>The coach</strong> is responsible for training-programming decisions and their suitability for each athlete.</>,
            <><strong>The athlete</strong> is responsible for reporting their status honestly and for listening to their body.</>,
            <>The professional relationship between coach and athlete is between them; Holy Oly provides the tool, does not deliver the coaching service and does not supervise the coach's decisions.</>,
          ]}
        />
      </Section>

      <Section n={7} id="exencion" title="Medical disclaimer, assumption of risk and emergencies">
        <Note>
          Strength training and weightlifting involve inherent risks of injury. The Service does not diagnose,
          treat or handle emergencies. In the event of persistent pain, an injury or any health warning sign,
          <strong> stop the activity and consult a professional</strong>. Use of the Service's information is at
          your own risk, and by using it you voluntarily assume the risks inherent to physical activity. In an
          emergency, contact your local emergency services.
        </Note>
      </Section>

      <Section n={8} id="uso" title="Acceptable use">
        <P>You agree not to:</P>
        <Bullets
          items={[
            "use the Service for unlawful purposes or to infringe third-party rights;",
            "attempt to access accounts, data or systems without authorization, or breach the security of the Service;",
            "extract data in bulk (scraping), overload the infrastructure or interfere with its operation;",
            "impersonate another person or misrepresent your link with a coach or athlete;",
            "reverse-engineer the Service, except to the extent the law mandatorily permits it;",
            "upload unlawful or harmful content, or content that infringes third-party rights.",
          ]}
        />
      </Section>

      <Section n={9} id="suscripcion" title="Subscription, billing and cancellation (coaches)">
        <Bullets
          items={[
            "Coach subscriptions are billed through our payment provider (Mercado Pago); athletes do not pay to link with a coach.",
            "The plan, its price and its period are shown before you subscribe. Unless stated otherwise, the subscription renews for successive periods until you cancel.",
            "You can cancel renewal at any time; cancellation takes effect for the following period.",
            "Refunds are governed by the consumer-protection law applicable to your country and by the payment provider's conditions.",
            "Prices may include or exclude taxes depending on your jurisdiction. If we change the price, we will inform you with reasonable notice before it applies to your next renewal.",
          ]}
        />
      </Section>

      <Section n={10} id="propiedad" title="Intellectual property">
        <P>
          The Service, its software, brand, designs and content (excluding User content) belong to Holy Oly or
          its licensors. We grant you a limited, revocable, non-exclusive and non-transferable license to use the
          Service in accordance with these Terms. If you send us suggestions, we may use them freely with no
          obligation to you.
        </P>
      </Section>

      <Section n={11} id="datos" title="Your content and your data">
        <P>
          <strong>Your content is yours.</strong> You grant us a limited license to host, process and display it
          for the sole purpose of operating the Service for you (for example, so your coach can see your progress
          or to project the redacted context of your cycle that you chose to share). The processing of your
          personal data is governed by the Privacy Policy. You can export or delete your data from the app at any
          time.
        </P>
      </Section>

      <Section n={12} id="terceros" title="Third-party services">
        <P>
          The Service relies on providers such as Google (sign-in and emails), Mercado Pago (payments) and
          Render (infrastructure). Use of those features may be subject to the terms and policies of those third
          parties. We are not responsible for third-party services or their availability.
        </P>
      </Section>

      <Section n={13} id="disponibilidad" title="Availability and changes to the service">
        <P>
          We work to keep the Service available, but it is provided “as is” and “as available”. We may modify,
          suspend or discontinue features, giving reasonable notice where the change is material and affects you
          significantly.
        </P>
      </Section>

      <Section n={14} id="garantias" title="Disclaimer of warranties">
        <P>
          To the maximum extent permitted by law, the Service is provided without warranties of any kind, express
          or implied, including merchantability, fitness for a particular purpose or non-infringement. We do not
          guarantee training, athletic or health results. Nothing in this section excludes warranties that cannot
          legally be excluded.
        </P>
      </Section>

      <Section n={15} id="responsabilidad" title="Limitation of liability">
        <P>
          To the maximum extent permitted by law, Holy Oly will not be liable for indirect, incidental, special or
          consequential damages, nor for loss of profits or data arising from the use or inability to use the
          Service. Our total aggregate liability is limited to the greater of the amount you paid for the Service
          in the twelve months before the event giving rise to the claim, or the minimum amount set by applicable
          law. These limitations <strong>do not apply</strong> to damages caused by willful misconduct or gross
          negligence, to liability for death or personal injury caused by our negligence, or to any non-waivable
          right granted to you by the law of your country.
        </P>
      </Section>

      <Section n={16} id="indemnidad" title="Indemnity">
        <P>
          To the extent permitted by law, you agree to hold us harmless from third-party claims arising from your
          misuse of the Service or your breach of these Terms. This obligation does not apply to the extent the
          claim arises from our own conduct and does not affect your non-waivable consumer rights.
        </P>
      </Section>

      <Section n={17} id="terminacion" title="Suspension and termination">
        <P>
          You can close your account at any time from the app. We may suspend or terminate your access if you
          breach these Terms or in the event of abuse, fraud or risk to the Service or to third parties, seeking
          to notify you where reasonable and legally possible. On termination, the granted licenses cease; clauses
          that by their nature should survive (data, liability, governing law) will remain in effect.
        </P>
      </Section>

      <Section n={18} id="modificaciones" title="Changes to the terms">
        <P>
          We may update these Terms. If the change is material, we will inform you by a reasonable means and,
          where appropriate, ask you to accept them again. Continued use of the Service after the effective date
          constitutes your acceptance of the updated Terms.
        </P>
      </Section>

      <Section n={19} id="ley" title="Governing law and dispute resolution">
        <P>
          These Terms are governed by the laws of the Argentine Republic, without prejudice to the mandatory
          consumer-protection and data-protection rules of your country of residence, which prevail where they
          grant you greater protection. Any dispute will be submitted to the courts of the owner's domicile in
          Argentina, without prejudice to the consumer's right to bring proceedings before the courts or forums of
          their own domicile where the law so permits. Before starting a claim, we ask you to try to resolve it
          with us by writing to <Contact />.
        </P>
      </Section>

      <Section n={20} id="generales" title="General provisions">
        <Bullets
          items={[
            <><strong>Severability:</strong> if a clause is invalid, the rest remains in effect.</>,
            <><strong>Entire agreement:</strong> these Terms and the Privacy Policy are the complete agreement between you and us regarding the Service.</>,
            <><strong>Assignment:</strong> you may not assign these Terms without our consent; we may assign them as part of a reorganization or acquisition, preserving your rights.</>,
            <><strong>No waiver:</strong> our failure to enforce a clause at a given time does not waive it.</>,
            <><strong>Force majeure:</strong> we are not liable for failures caused by events beyond our reasonable control.</>,
            <><strong>Language:</strong> the original language of these Terms is Spanish; any translation is provided for convenience only.</>,
          ]}
        />
      </Section>

      <Section n={21} id="contacto" title="Contact">
        <P>For any question about these Terms, write to us at <Contact />.</P>
      </Section>
    </>
  );
}
