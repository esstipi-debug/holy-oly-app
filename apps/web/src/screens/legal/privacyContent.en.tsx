import { P, Bullets, Section, Sub, Note, Defs, Table, Contact, Summary } from "./legalUi";

/**
 * Privacy Policy — English version (1:1 with privacyContent.tsx). Drafted to GDPR/UK-GDPR standard
 * and mapped to CCPA/CPRA, Argentina's Law 25.326, Chile's Law 19.628/21.719 and Brazil's LGPD.
 */
export function PrivacyContentEn() {
  return (
    <>
      <P>
        At Holy Oly, your trust is the product. This policy explains, in plain language, what data we
        process, for which purposes and on what legal basis, where it is stored, with whom it is shared
        and what control you have over it. We take special care with <strong>health data</strong> and, in
        particular, with <strong>menstrual cycle</strong> tracking, which is always optional, encrypted
        and under your control.
      </P>

      <Summary
        title="At a glance"
        items={[
          "We process only the data needed for a coach and athlete to coordinate training. We do not sell your data or use it for advertising.",
          "Cycle tracking is 100% optional (explicit opt-in), stored encrypted, and your coach never sees the raw data — only a redacted projection you choose to share.",
          "You can export all of your data or delete your account yourself, from within the app, at any time.",
          "Our infrastructure is in the U.S. (Oregon): using the app involves an international transfer, which you accept on an informed basis.",
          "You have rights of access, rectification, erasure, portability, objection and to withdraw your consent.",
        ]}
      />

      <Section n={1} id="responsable" title="Data controller">
        <P>
          The controller of your data is Holy Oly, operated by its owner (“Holy Oly”, “we”). You can reach
          us about any privacy matter, or to exercise your rights, at <Contact />. The controller's full
          registration details (legal name, registered address and tax identification) are available on
          request at that address and will be published once the entity is formally incorporated.
        </P>
      </Section>

      <Section n={2} id="alcance" title="Who and what this applies to">
        <P>
          This policy applies to everyone who uses Holy Oly — athletes and coaches — and to the data we
          process through the web application and our API. It does not apply to third-party sites or
          services we may link to, which are governed by their own policies.
        </P>
      </Section>

      <Section n={3} id="definiciones" title="Definitions">
        <Defs
          items={[
            ["Personal data", "any information relating to an identified or identifiable individual."],
            ["Sensitive / special-category data", "data deserving heightened protection — here, health data, including menstrual cycle tracking."],
            ["Processing", "any operation on personal data (collecting, storing, using, sharing, deleting)."],
            ["Controller", "the party that determines the purposes and means of processing (Holy Oly)."],
            ["Processor / subprocessor", "a party that processes data on the controller's behalf (e.g. the hosting provider)."],
            ["Coach and athlete", "the two roles in the app; the coach programs the training, the athlete carries it out and reports."],
          ]}
        />
      </Section>

      <Section n={4} id="datos" title="What data we process">
        <Table
          head={["Category", "Examples", "Required?", "Legal basis"]}
          rows={[
            ["Identity & account", "email, password (stored hashed), name, role (coach/athlete); or your Google identity if you sign in with OAuth", "Yes — to have an account", "Performance of the contract"],
            ["Training", "plan, exercises, weights, sets and reps, attendance, session dates, records", "Yes — it is the core of the service", "Performance of the contract"],
            ["Wellness (check-in)", "fatigue, soreness, stress, mood, motivation, sleep and body weight, if you log them", "No — optional", "Performance of the contract"],
            [<><strong>Menstrual cycle</strong> (sensitive)</>, "the fact that you track it, status (regular/irregular/no period) and, if you log them, last period start and typical cycle length", "No — explicit opt-in", "Your explicit consent"],
            ["Billing (coaches)", "plan, subscription status and payment-provider identifiers", "Only if you subscribe", "Performance of the contract and legal obligation"],
            ["Technical data", "IP address, request date/time and type, session cookie, security and audit logs", "Generated when you use the app", "Legitimate interest (security)"],
            ["Communications", "verification, password-reset and support emails", "Depending on use", "Performance of the contract"],
          ]}
        />
        <P>
          We do <strong>not</strong> process card numbers (handled by the payment provider), biometric
          data, geolocation or advertising identifiers.
        </P>
      </Section>

      <Section n={5} id="origen" title="How we obtain your data">
        <Bullets
          items={[
            <><strong>From you:</strong> when you register, log your training, your check-in or your cycle.</>,
            <><strong>Automatically:</strong> technical logs and the session cookie when you use the app.</>,
            <><strong>From your linked coach or athlete:</strong> the plan and prescription your coach creates for you (or that you, as a coach, create for your athletes).</>,
            <><strong>From Google:</strong> if you choose to sign in with Google, we receive the minimum account data needed to identify you.</>,
          ]}
        />
      </Section>

      <Section n={6} id="finalidades" title="Why we use your data and on what basis">
        <Bullets
          items={[
            <><strong>To provide the service</strong> (coordinate the plan between coach and athlete, show your progress): performance of the contract.</>,
            <><strong>To project and, if you choose, share the redacted context of your cycle:</strong> your explicit consent (which can be withdrawn at any time).</>,
            <><strong>Security, fraud and abuse prevention, and audit logs:</strong> legitimate interest.</>,
            <><strong>To bill coach subscriptions</strong> and meet accounting/tax obligations: performance of the contract and legal obligation.</>,
            <><strong>Service communications</strong> (email verification, password reset): performance of the contract.</>,
            <><strong>To comply with valid legal requirements:</strong> legal obligation.</>,
          ]}
        />
      </Section>

      <Section n={7} id="ciclo" title="Menstrual cycle data (special category)">
        <P>
          Cycle tracking receives the strictest treatment in the whole app. These are our commitments,
          which the system enforces technically:
        </P>
        <Bullets
          items={[
            <><strong>Opt-in by choice:</strong> the module stays invisible until you activate it by giving your informed consent. It is never assumed from your gender or enabled by default.</>,
            <><strong>What we process:</strong> the fact that you track it, the status (regular/irregular/no period) and, only if you log them, your last period start date and typical cycle length.</>,
            <><strong>What it is for:</strong> to project your cycle windows onto YOUR own training calendar and, only if you choose, to give your coach a redacted context.</>,
            <><strong>What your coach sees:</strong> you choose the level (None / Minimal / Context). Even at “Context”, your coach never sees your date, your phase or symptoms — only a signal, computed on our server, of whether you are in the luteal window today. The raw data never travels to the coach.</>,
            <><strong>What we do NOT do:</strong> we do not sell it, we do not use it for advertising or commercial profiling, and we do not share it with third parties beyond the subprocessors strictly necessary to host it securely.</>,
            <><strong>Encryption:</strong> it is stored encrypted (AES-256-GCM) at rest.</>,
            <><strong>Full control:</strong> you can edit it, change what you share, withdraw consent and delete the entire record whenever you want. On revocation, your coach immediately stops seeing any context.</>,
            <><strong>Retention:</strong> until you delete it or delete your account.</>,
            <><strong>Legal basis:</strong> your explicit consent. For California residents, we treat it as “sensitive personal information” with use limited to providing the service.</>,
          ]}
        />
        <Note>
          Cycle tracking is a context tool for your training. <strong>It is not a diagnosis and does not
          replace the advice of a health professional.</strong>
        </Note>
      </Section>

      <Section n={8} id="cookies" title="Cookies and similar technologies">
        <Bullets
          items={[
            <><strong>Session cookie (strictly necessary):</strong> keeps you securely signed in (httpOnly). It is essential to the service and requires no consent.</>,
            <><strong>Google</strong> (if you choose to sign in with Google): Google may use its own cookies, governed by its policy.</>,
            <><strong>Mercado Pago</strong> (if you subscribe as a coach): provider cookies during the payment process.</>,
          ]}
        />
        <P>
          We do not use advertising cookies, third-party analytics or cross-site tracking. You can manage
          cookies from your browser; blocking the session cookie will prevent you from signing in.
        </P>
      </Section>

      <Section n={9} id="comparte" title="Who we share your data with">
        <P>We rely on a minimal set of providers (processors):</P>
        <Table
          head={["Provider", "Purpose", "Location", "Safeguards"]}
          rows={[
            ["Render", "App hosting and database", "U.S. (Oregon)", "Provider's Standard Contractual Clauses (SCCs); encryption in transit"],
            ["Google", "Transactional emails; sign-in with Google (optional)", "U.S. / global", "SCCs; your consent when using Google"],
            ["Mercado Pago", "Coach subscription billing", "Per your country", "Provider standards (PCI-DSS); its own terms and policy"],
          ]}
        />
        <P>
          <strong>We do not sell or rent your data.</strong> Your coach can access only what corresponds to
          a link accepted by both parties and, for the cycle, only the redacted projection you chose. We may
          disclose data if validly required by law (e.g. a court order), seeking to notify you unless legally
          prohibited.
        </P>
      </Section>

      <Section n={10} id="transferencias" title="International transfers">
        <P>
          Your data is hosted and processed in the <strong>U.S. (Oregon)</strong>. If you are in the
          European Union/EEA, the United Kingdom, Argentina, Chile or another country, using the app
          involves an international data transfer.
        </P>
        <Bullets
          items={[
            <>For <strong>EEA/UK</strong> residents, the transfer relies on our providers' Standard Contractual Clauses (SCCs) and/or your explicit, informed consent (GDPR art. 49(1)(a)) given when you create your account, having been informed that the destination country may not offer equivalent guarantees (e.g. possible access by authorities).</>,
            <>The <strong>cycle data</strong> is transferred only with your explicit consent and always encrypted.</>,
            <>You can request more information about the safeguards by writing to <Contact />.</>,
          ]}
        />
      </Section>

      <Section n={11} id="conservacion" title="How long we keep your data">
        <Table
          head={["Data", "Retention period"]}
          rows={[
            ["Account and training", "While your account is active; deleted when you delete the account"],
            ["Menstrual cycle", "Until you revoke/delete it or delete your account"],
            ["Billing (coaches)", "The accounting and tax periods legally required after cancellation"],
            ["Security/audit logs", "Limited period; only identifiers, action and IP — never health data"],
            ["Backups", "Periodic rotation; deleted data is purged from backups within the rotation cycle"],
          ]}
        />
      </Section>

      <Section n={12} id="seguridad" title="How we protect your data">
        <Bullets
          items={[
            "Encryption in transit (HTTPS/TLS) across the entire service.",
            "Encryption at rest of cycle data (AES-256-GCM).",
            "Passwords stored with strong hashing (Argon2id); never stored in clear text.",
            "Revocable server sessions; you can sign out on all your devices.",
            "Access control: a coach sees an athlete's data only with an accepted link, and for the cycle only the redacted projection.",
            "Audit logging without sensitive data (identifiers, action and IP only).",
            "Data minimization: we process only what is necessary.",
          ]}
        />
        <P>
          No system is completely infallible, but we apply reasonable technical and organizational measures
          proportionate to the risk in order to protect your data.
        </P>
      </Section>

      <Section n={13} id="incidentes" title="Security incident notification">
        <P>
          If a security breach affecting your personal data occurs, we will assess it without undue delay
          and, where applicable, notify the competent supervisory authority and you in accordance with
          applicable law (for example, under the GDPR: the authority within 72 hours where required, and you
          without undue delay where there is a high risk to your rights).
        </P>
      </Section>

      <Section n={14} id="derechos" title="Your rights">
        <Bullets
          items={[
            <><strong>Access:</strong> know what data we process and obtain a copy.</>,
            <><strong>Rectification:</strong> correct inaccurate or incomplete data.</>,
            <><strong>Erasure (“right to be forgotten”):</strong> delete your account and your data.</>,
            <><strong>Restriction:</strong> restrict processing in the cases provided by law.</>,
            <><strong>Portability:</strong> receive your data in a structured, commonly used format (JSON).</>,
            <><strong>Objection:</strong> object to processing based on our legitimate interest.</>,
            <><strong>Withdraw consent:</strong> at any time (e.g. deactivate the cycle), without affecting the lawfulness of prior processing.</>,
            <><strong>Not be subject to automated decisions</strong> with legal or significant effect: we do not make such decisions (see §16).</>,
            <><strong>Complain</strong> to a supervisory authority (see §19).</>,
          ]}
        />
        <P>
          <strong>How to exercise them:</strong> in the app, under Account → “Your data”, you can <strong>export</strong>
          all of your data and <strong>delete</strong> your account yourself. You can also write to us at <Contact />.
          We will respond without undue delay and, at the latest, within the period set by your law (in the EU,
          one month, extendable). It is free of charge, except for manifestly unfounded or excessive requests.
        </P>
      </Section>

      <Section n={15} id="region" title="Your rights depending on where you are">
        <Sub title="European Union / EEA and United Kingdom (GDPR / UK GDPR)">
          <P>You have all the rights in §14. The transfer to the U.S. is governed by §10. You may complain to your local authority or to that of the place of the alleged infringement.</P>
        </Sub>
        <Sub title="California (CCPA / CPRA)">
          <P>The right to know, delete and correct; to opt out of the “sale” or “sharing” of your information (we do neither); to limit the use of your sensitive personal information (we process the cycle on a limited-use basis); and not to be discriminated against for exercising your rights. We have not sold or shared personal information in the last twelve months.</P>
        </Sub>
        <Sub title="Argentina (Law 25.326)">
          <P>Rights of access, rectification, update and deletion. Health data is sensitive data with heightened protection. You may complain to the Agency for Access to Public Information (AAIP).</P>
        </Sub>
        <Sub title="Chile (Law 19.628 and Law 21.719)">
          <P>Rights of access, rectification, cancellation/deletion and objection, with heightened protection of sensitive data.</P>
        </Sub>
        <Sub title="Brazil (LGPD) and other countries">
          <P>Rights of confirmation, access, correction, anonymization/blocking/deletion, portability and information about data sharing. In any other country, we respect the rights granted to you by your local law.</P>
        </Sub>
      </Section>

      <Section n={16} id="automatizadas" title="Automated decisions and profiling">
        <P>
          We do not make automated decisions that produce legal or significant effects on you. Training is
          programmed by your coach, who is a person. The projections (cycle, intensity maps) are informational
          and do not decide for you.
        </P>
      </Section>

      <Section n={17} id="menores" title="Minors">
        <P>
          The service is intended for adults. It is not directed to anyone under 18; if you are a minor, you
          may use it only with the authorization and supervision of your legal guardian. If we learn that we
          are processing a minor's data without such authorization, we will delete it.
        </P>
      </Section>

      <Section n={18} id="cambios" title="Changes to this policy">
        <P>
          We may update this policy. If the change is material, we will inform you by a reasonable means (in
          the app or by email) and, where the law requires it or the change affects processing based on your
          consent, we will ask you to accept it again before continuing. The current version and its date
          appear at the top of the document.
        </P>
      </Section>

      <Section n={19} id="autoridades" title="Complaints to supervisory authorities">
        <P>Without prejudice to any other remedy, you have the right to lodge a complaint with the competent authority:</P>
        <Bullets
          items={[
            <><strong>Argentina:</strong> Agency for Access to Public Information (AAIP).</>,
            <><strong>EU/EEA:</strong> your local data protection authority.</>,
            <><strong>United Kingdom:</strong> Information Commissioner's Office (ICO).</>,
            <><strong>Chile:</strong> the competent data protection authority.</>,
            <><strong>California:</strong> California Privacy Protection Agency (CPPA) or the State Attorney General.</>,
          ]}
        />
        <P>We would appreciate the chance to resolve it first — write to us at <Contact />.</P>
      </Section>

      <Section n={20} id="contacto" title="Contact">
        <P>
          For any question about this policy, about your data or to exercise your rights, write to us at <Contact />.
          We handle privacy requests as a priority.
        </P>
      </Section>
    </>
  );
}
