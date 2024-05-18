import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { CalendarOptions } from '@fullcalendar/core';
import { ServicesService } from 'src/app/EduSchoolBackOffice/Services/services.service';
import frLocale from '@fullcalendar/core/locales/fr';
import Swal from 'sweetalert2';
import { Observer, forkJoin, map } from 'rxjs';

@Component({
  selector: 'app-gere-rdv',
  templateUrl: './gere-rdv.component.html',
  styleUrls: ['./gere-rdv.component.css']
})
export class GereRdvComponent implements OnInit {
  plugin = [dayGridPlugin, timeGridPlugin];
  calendarOptions: CalendarOptions = {
    initialView: 'timeGridWeek',
    plugins: this.plugin
  }
  eleves: any;
  rdvs: any;
  enseignants: any;
  rdvForm!: FormGroup;
  examen:any;
  events :any = [];
  constructor(private service:ServicesService) { }

  ngOnInit(): void {
    this.rdvForm = new FormGroup({
      eleve : new FormControl('',Validators.required),
      date : new FormControl('',Validators.required),
      enseignant : new FormControl('',Validators.required)
    });
    this.service.getAllEleve().subscribe(
      (data) => {
        this.eleves = data;
      }
    )
    this.service.getAllEnseignant().subscribe(
      (data)=>{

        this.enseignants =data;
      }
    )
   
    this.getAllRdv();
    }
    getAllRdv(){
      this.service.getAllRdv().subscribe(
        (data)=>{
          this.rdvs = data;

         this.processRdvs()
        }) 
    }
    processRdvs() {
      const rdvObservables = this.rdvs.map((rdv: { eleve: { id: number; }; enseignant: { id: number; }; id: any; date: any; }) => {
        return forkJoin({
          eleve: this.service.getEleveByID(rdv.eleve.id),
          enseignant: this.service.getEnseignantByID(rdv.enseignant.id)
        }).pipe(
          map(results => ({
            id: rdv.id,
            eleve: results.eleve.nom,
            enseignant: results.enseignant.nom,
            date: rdv.date
          }))
        );
      });
      forkJoin(rdvObservables).subscribe(events => {
        this.events = events;
        this.initializeCalendar();
      });
    }
    initializeCalendar() {
      this.calendarOptions = {
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        selectable: true,
        locale: frLocale,
        slotMinTime: '08:00:00',
        slotMaxTime: '17:00:00',
        editable: true,
        events: this.events,
        eventClick: this.handleEventClick.bind(this)
      };
    }
      
      handleEventClick(info: { event: any; }) {
        const event = info.event;
        const eventData = {
          title: 'Rendez-vous',
          Id:event.id,
          otherInfo: {
            Eleve: event.extendedProps.eleve,
            Enseignant: event.extendedProps.enseignant ,
            Date: event.extendedProps.date
          }
        };
        Swal.fire({
          html: `
            <p><strong>Title:</strong> ${eventData.title}</p>
            <p><strong>Eleve:</strong> ${eventData.otherInfo.Eleve}</p>
            <p><strong>Enseignant:</strong> ${eventData.otherInfo.Enseignant}</p> 
            <button id="edit-date-btn" class="btn btn-primary">Modifier la date</button>`,
            
            icon: 'info',
            showCloseButton: true,
            showDenyButton: true,
            denyButtonText: `Supprimer`,
            showConfirmButton: false,
        }).then((result) => {
          if (result.isConfirmed) {
            Swal.fire("Saved!", "", "success");
          } else if (result.isDenied) {
            Swal.fire({
              title: 'Confirmation',
              text: 'Êtes-vous sûr de vouloir supprimer ce rendez-vous ?',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Oui',
              cancelButtonText: 'Non'
            }).then((confirmResult) => {
              if (confirmResult.isConfirmed) {
                this.deleteEvent(event);
                Swal.fire('Deleted!', 'Le rendez-vous a étè supprimer', 'success');
              } else if (confirmResult.dismiss === Swal.DismissReason.cancel) {
                Swal.fire('Annulation', "Votre rendez-vous n'est pas supprime :)", 'info');
                
              }
              this.getAllRdv();
            });
          }
        });
        setTimeout(() => {
          document.getElementById('edit-date-btn')?.addEventListener('click', () => {
            this.editDate(event);
          });
        }, 0);
      }
      editDate(event: any) {
        Swal.fire({
          title: 'Modifier la date',
          html: `
            <input type="datetime-local" id="new-date" class="swal2-input" value="${event.start.toISOString().slice(0, 16)}">
          `,
          showCancelButton: true,
          confirmButtonText: 'Enregistrer',
          preConfirm: () => {
            const newDate = (document.getElementById('new-date') as HTMLInputElement).value;
            if (!newDate) {
              Swal.showValidationMessage('Veuillez entrer une date valide');
            }
            return newDate;
          }
        }).then((result) => {
          if (result.isConfirmed) {
            this.updateEventDate(event.id,  new Date(result.value));
          }
        });
      }
      updateEventDate(eventId: number, newDate: any) {
        // Créer un objet Observer pour gérer les événements
        const observer: Observer<any> = {
          next: () => {
            Swal.fire('Date modifiée avec succès', '', 'success');
            // Recharger ou mettre à jour le calendrier pour refléter les changements
            this.getAllRdv();
          },
          error: (error) => {
            Swal.fire('Erreur lors de la modification de la date', error.message, 'error');
          },
          complete: function (): void {
            throw new Error('Function not implemented.');
          }
        };
      
        // Appeler la méthode de mise à jour avec la nouvelle date et l'ID de l'événement
        this.service.updateRdv(newDate, eventId).subscribe(observer);
      }
      
  deleteEvent(event: any) {
    this.service.deleteRdv(event.id).subscribe()
  }
      
  toggleWeekends() {
    this.calendarOptions.weekends = !this.calendarOptions.weekends 
  }
  ajouterExamen(){
    if (this.rdvForm.invalid) {
      Swal.fire({
        title: 'Error!',
        text: 'il faut remplir les champs ',
        icon: 'error',
        confirmButtonText: 'ok',
        showCancelButton: true
      });
      return; 
    }
    this.service.createRdv(this.rdvForm.value).subscribe(  )
     
    Swal.fire({
      position: 'center',
      icon: 'success',
      title: 'votre données à été ajouté avec success',
      showConfirmButton: false,
      timer: 1500
    });
  }
}