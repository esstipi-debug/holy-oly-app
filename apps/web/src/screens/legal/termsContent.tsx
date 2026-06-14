import { P, Bullets, Section, Note, Defs, Contact, Summary } from "./legalUi";

/**
 * Términos y Condiciones — cuerpo del documento (el shell + metadatos los pone LegalPages).
 * Redactados como contrato operativo de una SaaS internacional: descripción del servicio (no médico),
 * exención y asunción de riesgo, suscripción/cancelación, propiedad de datos, límites de
 * responsabilidad y ley aplicable, preservando los derechos imperativos del consumidor.
 */
export function TermsContent() {
  return (
    <>
      <P>
        Estos Términos y Condiciones (los «Términos») son el contrato entre vos y Holy Oly que regula el
        uso de la aplicación y los servicios asociados (el «Servicio»). Al crear una cuenta o usar el
        Servicio, aceptás estos Términos y nuestra Política de Privacidad. Si no estás de acuerdo, no uses
        el Servicio.
      </P>

      <Summary
        items={[
          "Holy Oly es una herramienta para coordinar el entrenamiento entre coach y atleta. No es un servicio médico ni atiende emergencias.",
          "El coach decide la programación; el atleta reporta con honestidad y escucha a su cuerpo. El entrenamiento de fuerza implica riesgos que asumís.",
          "Tus datos son tuyos: podés exportarlos o borrarlos cuando quieras.",
          "La suscripción la pagan los coaches; los atletas no pagan por vincularse.",
          "Nada en estos Términos limita los derechos irrenunciables que te otorgue la ley de tu país.",
        ]}
      />

      <Section n={1} id="aceptacion" title="Aceptación y partes">
        <P>
          El Servicio es operado por Holy Oly, a través de su titular (la identificación registral completa
          está disponible a pedido en <Contact />). Estos Términos aplican a toda persona que use el
          Servicio. Si lo usás en nombre de una organización, declarás tener facultades para obligarla.
        </P>
      </Section>

      <Section n={2} id="definiciones" title="Definiciones">
        <Defs
          items={[
            ["Servicio", "la aplicación Holy Oly, su API y las funciones asociadas."],
            ["Coach", "quien usa el Servicio para programar y dar seguimiento al entrenamiento de sus atletas."],
            ["Atleta", "quien usa el Servicio para ver su plan, entrenar y reportar su estado."],
            ["Vínculo", "la relación, aceptada por ambas partes, que conecta a un coach con un atleta dentro del Servicio."],
            ["Contenido del usuario", "los datos que cargás (entrenamiento, check-in, ciclo, etc.)."],
          ]}
        />
      </Section>

      <Section n={3} id="servicio" title="Descripción del servicio">
        <P>
          Holy Oly es una herramienta de coordinación deportiva entre coach y atleta: planificación de
          macrociclos, prescripción, seguimiento del progreso y contexto opcional de bienestar y ciclo.
          <strong> No es un servicio médico, nutricional ni de emergencias</strong>, y no sustituye el
          asesoramiento de profesionales de la salud.
        </P>
      </Section>

      <Section n={4} id="elegibilidad" title="Elegibilidad y edad">
        <P>
          Para usar el Servicio debés ser mayor de edad o contar con la autorización y supervisión de tu
          representante legal. El Servicio no está dirigido a menores de 18 años.
        </P>
      </Section>

      <Section n={5} id="cuenta" title="Tu cuenta">
        <Bullets
          items={[
            "Sos responsable de la veracidad de los datos que cargás y de mantener actualizada tu información.",
            "Sos responsable de la confidencialidad de tu contraseña y de toda actividad realizada con tu cuenta.",
            "Avisanos sin demora si sospechás un uso no autorizado de tu cuenta.",
          ]}
        />
      </Section>

      <Section n={6} id="roles" title="Roles y responsabilidades">
        <Bullets
          items={[
            <><strong>El coach</strong> es responsable de las decisiones de programación del entrenamiento y de su idoneidad para cada atleta.</>,
            <><strong>El atleta</strong> es responsable de reportar su estado con honestidad y de escuchar a su cuerpo.</>,
            <>La relación profesional entre coach y atleta es entre ellos; Holy Oly provee la herramienta, no presta el servicio de entrenamiento ni supervisa las decisiones del coach.</>,
          ]}
        />
      </Section>

      <Section n={7} id="exencion" title="Exención médica, asunción de riesgo y emergencias">
        <Note>
          El entrenamiento de fuerza y la halterofilia implican riesgos inherentes de lesión. El Servicio
          no diagnostica, no trata ni atiende emergencias. Ante dolor persistente, una lesión o cualquier
          señal de alarma de salud, <strong>detené la actividad y consultá a un profesional</strong>. El uso
          de la información del Servicio es bajo tu responsabilidad, y al usarlo asumís voluntariamente los
          riesgos propios de la actividad física. En una emergencia, contactá a los servicios de urgencia
          de tu localidad.
        </Note>
      </Section>

      <Section n={8} id="uso" title="Uso aceptable">
        <P>Te comprometés a no:</P>
        <Bullets
          items={[
            "usar el Servicio con fines ilícitos o para vulnerar derechos de terceros;",
            "intentar acceder sin autorización a cuentas, datos o sistemas, ni vulnerar la seguridad del Servicio;",
            "extraer datos de forma masiva (scraping), sobrecargar la infraestructura o interferir con su funcionamiento;",
            "suplantar a otra persona o falsear tu vínculo con un coach o atleta;",
            "realizar ingeniería inversa del Servicio, salvo en la medida que la ley lo permita de forma imperativa;",
            "subir contenido ilícito, dañino o que infrinja derechos de terceros.",
          ]}
        />
      </Section>

      <Section n={9} id="suscripcion" title="Suscripción, facturación y cancelación (coaches)">
        <Bullets
          items={[
            "La suscripción de coach se factura a través de nuestro proveedor de pagos (Mercado Pago); los atletas no pagan por vincularse a un coach.",
            "El plan, su precio y su período se muestran antes de contratar. Salvo que se indique lo contrario, la suscripción se renueva por períodos sucesivos hasta que la canceles.",
            "Podés cancelar la renovación en cualquier momento; la cancelación rige para el período siguiente.",
            "Los reembolsos se rigen por la ley de protección al consumidor aplicable a tu país y por las condiciones del proveedor de pagos.",
            "Los precios pueden incluir o excluir impuestos según tu jurisdicción. Si cambiamos el precio, te lo informaremos con antelación razonable antes de que aplique a tu próxima renovación.",
          ]}
        />
      </Section>

      <Section n={10} id="propiedad" title="Propiedad intelectual">
        <P>
          El Servicio, su software, su marca, sus diseños y sus contenidos (excluido el Contenido del
          usuario) pertenecen a Holy Oly o a sus licenciantes. Te otorgamos una licencia limitada,
          revocable, no exclusiva e intransferible para usar el Servicio conforme a estos Términos. Si nos
          envías sugerencias, podemos usarlas libremente sin obligación hacia vos.
        </P>
      </Section>

      <Section n={11} id="datos" title="Tu contenido y tus datos">
        <P>
          <strong>El Contenido del usuario es tuyo.</strong> Nos otorgás una licencia limitada para
          alojarlo, procesarlo y mostrarlo con el único fin de operar el Servicio para vos (por ejemplo,
          para que tu coach vea tu progreso o para proyectar el contexto redactado de tu ciclo que elegiste
          compartir). El tratamiento de tus datos personales se rige por la Política de Privacidad. Podés
          exportar o eliminar tus datos desde la app en cualquier momento.
        </P>
      </Section>

      <Section n={12} id="terceros" title="Servicios de terceros">
        <P>
          El Servicio se apoya en proveedores como Google (inicio de sesión y emails), Mercado Pago (pagos)
          y Render (infraestructura). El uso de esas funciones puede estar sujeto a los términos y políticas
          de dichos terceros. No somos responsables por los servicios de terceros ni por su disponibilidad.
        </P>
      </Section>

      <Section n={13} id="disponibilidad" title="Disponibilidad y cambios del servicio">
        <P>
          Trabajamos para mantener el Servicio disponible, pero se ofrece «tal cual» y «según
          disponibilidad». Podemos modificar, suspender o discontinuar funciones, dando un aviso razonable
          cuando el cambio sea material y te afecte de forma significativa.
        </P>
      </Section>

      <Section n={14} id="garantias" title="Renuncia de garantías">
        <P>
          En la máxima medida permitida por la ley, el Servicio se provee sin garantías de ningún tipo,
          expresas o implícitas, incluidas las de comerciabilidad, idoneidad para un fin particular o no
          infracción. No garantizamos resultados de entrenamiento, deportivos ni de salud. Nada en esta
          sección excluye garantías que no puedan excluirse legalmente.
        </P>
      </Section>

      <Section n={15} id="responsabilidad" title="Limitación de responsabilidad">
        <P>
          En la máxima medida permitida por la ley, Holy Oly no será responsable por daños indirectos,
          incidentales, especiales o consecuentes, ni por lucro cesante o pérdida de datos derivados del uso
          o la imposibilidad de uso del Servicio. Nuestra responsabilidad total acumulada se limita al mayor
          entre el importe que hayas pagado por el Servicio en los doce meses previos al hecho que originó el
          reclamo, o el monto mínimo que fije la ley aplicable. Estas limitaciones <strong>no aplican</strong> a
          los daños por dolo o culpa grave, a la responsabilidad por muerte o daño personal causado por
          nuestra negligencia, ni a ningún derecho irrenunciable que te otorgue la ley de tu país.
        </P>
      </Section>

      <Section n={16} id="indemnidad" title="Indemnidad">
        <P>
          En la medida permitida por la ley, te comprometés a mantenernos indemnes frente a reclamos de
          terceros que deriven de tu uso indebido del Servicio o de tu incumplimiento de estos Términos.
          Esta obligación no aplica en la medida en que el reclamo se origine en nuestra propia conducta ni
          afecta tus derechos imperativos como consumidor.
        </P>
      </Section>

      <Section n={17} id="terminacion" title="Suspensión y terminación">
        <P>
          Podés cerrar tu cuenta cuando quieras desde la app. Podemos suspender o terminar tu acceso si
          incumplís estos Términos o ante abuso, fraude o riesgo para el Servicio o para terceros,
          procurando avisarte cuando sea razonable y legalmente posible. Al terminar, cesan las licencias
          otorgadas; las cláusulas que por su naturaleza deban subsistir (datos, responsabilidad, ley
          aplicable) seguirán vigentes.
        </P>
      </Section>

      <Section n={18} id="modificaciones" title="Modificaciones de los términos">
        <P>
          Podemos actualizar estos Términos. Si el cambio es material, te lo informaremos por un medio
          razonable y, cuando corresponda, te pediremos que los aceptes nuevamente. El uso continuado del
          Servicio tras la entrada en vigencia implica tu aceptación de los Términos actualizados.
        </P>
      </Section>

      <Section n={19} id="ley" title="Ley aplicable y resolución de disputas">
        <P>
          Estos Términos se rigen por las leyes de la República Argentina, sin perjuicio de las normas
          imperativas de protección al consumidor y de datos personales de tu país de residencia, que
          prevalecen cuando te otorguen mayor protección. Cualquier disputa se someterá a los tribunales del
          domicilio del titular en Argentina, sin perjuicio del derecho del consumidor a recurrir a los
          tribunales o foros de su propio domicilio cuando la ley se lo permita. Antes de iniciar un
          reclamo, te pedimos que intentes resolverlo con nosotros escribiéndonos a <Contact />.
        </P>
      </Section>

      <Section n={20} id="generales" title="Disposiciones generales">
        <Bullets
          items={[
            <><strong>Divisibilidad:</strong> si una cláusula resulta inválida, el resto sigue vigente.</>,
            <><strong>Acuerdo íntegro:</strong> estos Términos y la Política de Privacidad son el acuerdo completo entre vos y nosotros sobre el Servicio.</>,
            <><strong>Cesión:</strong> no podés ceder estos Términos sin nuestro consentimiento; nosotros podemos cederlos en el marco de una reorganización o adquisición, manteniendo tus derechos.</>,
            <><strong>No renuncia:</strong> que no exijamos una cláusula en un momento no implica renunciar a ella.</>,
            <><strong>Fuerza mayor:</strong> no respondemos por incumplimientos causados por hechos fuera de nuestro control razonable.</>,
            <><strong>Idioma:</strong> el idioma original de estos Términos es el español; cualquier traducción se ofrece sólo por conveniencia.</>,
          ]}
        />
      </Section>

      <Section n={21} id="contacto" title="Contacto">
        <P>Para cualquier consulta sobre estos Términos, escribinos a <Contact />.</P>
      </Section>
    </>
  );
}
