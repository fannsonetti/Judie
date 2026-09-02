//! Windows/desktop widget designer using the same Slint faces as judie-pi.
#![cfg(feature = "pi-native")]

#[path = "../pi_room.rs"]
mod pi_room;

slint::include_modules!();

use pi_room::SlopNode as RoomNode;
use slint::{ComponentHandle, ModelRc, VecModel};

fn slop_ui(n: &RoomNode) -> SlopNode {
    let (r, g, b) = pi_room::Room::node_rgb(n);
    SlopNode {
        widget_id: "".into(),
        id: n.id.clone().into(),
        kind: n.kind.clone().into(),
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        text: n.text.clone().into(),
        r,
        g,
        b,
        value: n.value,
    }
}

fn current_nodes() -> Vec<RoomNode> {
    pi_room::with(|room| {
        if room.gallery_kind == "custom" || room.gallery_kind.is_empty() {
            room.creator_nodes.clone()
        } else {
            room.face_nodes(&room.gallery_kind, &room.creator_size)
        }
    })
}

fn push_nodes(ui: &DesignWindow) {
    let nodes = current_nodes();
    let model: Vec<SlopNode> = nodes.iter().map(slop_ui).collect();
    ui.set_nodes(ModelRc::new(VecModel::from(model)));
    pi_room::with(|room| {
        ui.set_kind(if room.gallery_kind.is_empty() {
            "custom".into()
        } else {
            room.gallery_kind.clone().into()
        });
        ui.set_size(room.creator_size.clone().into());
        ui.set_widget_name(room.creator_name.clone().into());
        ui.set_selected(room.creator_selected.clone().into());
        ui.set_selected_kind(room.selected_creator_kind_label().into());
        ui.set_node_text(room.selected_creator_text().into());
        ui.set_path_text(pi_room::face_layouts_path().display().to_string().into());
    });
}

fn main() {
    let ui = DesignWindow::new().expect("design window");
    pi_room::with(|room| {
        room.gallery_kind = "custom".into();
        room.creator_size = "1x1".into();
        room.creator_name = "Untitled".into();
        if room.creator_nodes.is_empty() {
            room.add_creator_kind("text");
        }
    });
    push_nodes(&ui);

    let weak = ui.as_weak();
    ui.on_set_kind(move |k| {
        pi_room::with(|room| {
            room.gallery_kind = k.to_string();
            if k != "custom" {
                room.creator_nodes = room.face_nodes(k.as_str(), &room.creator_size);
                room.creator_selected = room.creator_nodes.first().map(|n| n.id.clone()).unwrap_or_default();
            }
        });
        if let Some(ui) = weak.upgrade() {
            push_nodes(&ui);
        }
    });

    let weak = ui.as_weak();
    ui.on_set_size(move |s| {
        pi_room::with(|room| {
            room.creator_size = s.to_string();
            if room.gallery_kind != "custom" {
                room.creator_nodes = room.face_nodes(&room.gallery_kind, s.as_str());
            }
        });
        if let Some(ui) = weak.upgrade() {
            push_nodes(&ui);
        }
    });

    let weak = ui.as_weak();
    ui.on_add_part(move |k| {
        pi_room::with(|room| room.add_creator_kind(k.as_str()));
        if let Some(ui) = weak.upgrade() {
            push_nodes(&ui);
        }
    });

    let weak = ui.as_weak();
    ui.on_select_node(move |id| {
        pi_room::with(|room| room.select_creator_node(id.as_str()));
        if let Some(ui) = weak.upgrade() {
            push_nodes(&ui);
        }
    });

    let weak = ui.as_weak();
    ui.on_patch_node(move |id, x, y, w, h| {
        pi_room::with(|room| room.patch_creator_node(id.as_str(), x, y, w, h));
        if let Some(ui) = weak.upgrade() {
            let nodes = current_nodes();
            ui.set_nodes(ModelRc::new(VecModel::from(nodes.iter().map(slop_ui).collect::<Vec<_>>())));
        }
    });

    let weak = ui.as_weak();
    ui.on_node_text_changed(move |t| {
        pi_room::with(|room| room.set_creator_node_text(t.as_str()));
        if let Some(ui) = weak.upgrade() {
            push_nodes(&ui);
        }
    });

    let weak = ui.as_weak();
    ui.on_delete_node(move || {
        pi_room::with(|room| room.delete_creator_node());
        if let Some(ui) = weak.upgrade() {
            push_nodes(&ui);
        }
    });

    ui.on_name_changed(move |t| {
        pi_room::with(|room| room.creator_name = t.to_string());
    });

    let weak = ui.as_weak();
    ui.on_save(move || {
        let msg = pi_room::with(|room| {
            let nodes = room.creator_nodes.clone();
            let size = room.creator_size.clone();
            if room.gallery_kind == "custom" || room.gallery_kind.is_empty() {
                match room.save_creator() {
                    Ok(()) => format!("Saved custom widget to {}", pi_room::face_layouts_path().display()),
                    Err(e) => e,
                }
            } else {
                let kind = room.gallery_kind.clone();
                room.set_face_layout(&kind, &size, nodes);
                format!("Saved {kind} {size} to {}", pi_room::face_layouts_path().display())
            }
        });
        if let Some(ui) = weak.upgrade() {
            ui.set_status(msg.into());
            push_nodes(&ui);
        }
    });

    let weak = ui.as_weak();
    ui.on_load(move || {
        pi_room::with(|room| {
            if room.gallery_kind != "custom" {
                room.creator_nodes = room.face_nodes(&room.gallery_kind, &room.creator_size);
                room.creator_selected = room.creator_nodes.first().map(|n| n.id.clone()).unwrap_or_default();
            }
        });
        if let Some(ui) = weak.upgrade() {
            ui.set_status("Reloaded.".into());
            push_nodes(&ui);
        }
    });

    ui.run().expect("design window");
}
